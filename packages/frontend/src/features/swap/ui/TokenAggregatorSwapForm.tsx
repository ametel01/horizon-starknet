'use client';

import type { MarketData } from '@entities/market';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import { PriceImpactWarning, usePriceImpact, usePriceImpactWarning } from '@features/price';
import {
  calculateMinOutput,
  type SwapData,
  type TokenInput as TokenInputType,
  type TokenOutput,
  useSwapPtForToken,
  useSwapTokenForPt,
  useSwapTokenForYt,
  useSwapYtForToken,
} from '@features/swap';
import { PriceImpactMeter } from '@features/swap/ui/PriceImpactMeter';
import { TransactionProgress } from '@features/swap/ui/TransactionProgress';
import { useAccount, useStarknet } from '@features/wallet';
import { getMarketInfos } from '@shared/config/addresses';
import { useEstimateFee } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { formatWad, parseWad } from '@shared/math/wad';
import { useAnimatedNumber } from '@shared/ui/AnimatedNumber';
import { Button } from '@shared/ui/Button';
import {
  FormActions,
  FormDivider,
  FormInputSection,
  FormLayout,
  FormOutputSection,
} from '@shared/ui/FormLayout';
import { NearExpiryWarning } from '@shared/ui/NearExpiryWarning';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { ArrowUpDown, Info, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type TokenType = 'PT' | 'YT';
type SwapMode = 'buy' | 'sell';

interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  /** Whether this token requires aggregator swap (not SY) */
  isExternal: boolean;
}

interface AggregatorSwapFormProps {
  market: MarketData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SLIPPAGE_OPTIONS = [
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
  { label: '2%', value: 200 },
];

// Placeholder aggregator address - in production this would come from config
const PLACEHOLDER_AGGREGATOR = '0x0';

// Empty swap data for when no aggregator is needed
const EMPTY_SWAP_DATA: SwapData = {
  aggregator: PLACEHOLDER_AGGREGATOR,
  calldata: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build available token list for the current market.
 * Includes SY token and the underlying yield token.
 */
function buildTokenList(
  market: MarketData,
  syAddress: string,
  underlyingAddress: string | undefined
): TokenConfig[] {
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';

  const tokens: TokenConfig[] = [
    {
      address: syAddress,
      symbol: `SY-${tokenSymbol}`,
      name: `Standardized Yield ${tokenSymbol}`,
      isExternal: false, // SY doesn't need aggregator
    },
  ];

  // Add underlying yield token if available
  if (underlyingAddress && market.metadata) {
    tokens.push({
      address: underlyingAddress,
      symbol: tokenSymbol,
      name: market.metadata.yieldTokenName,
      isExternal: true, // Needs aggregator for SY conversion
    });
  }

  return tokens;
}

/**
 * Derive button state based on form state.
 */
function deriveButtonState(params: {
  isConnected: boolean;
  isValidAmount: boolean;
  hasInsufficientBalance: boolean;
  hasInsufficientCollateral: boolean;
  isSwapping: boolean;
  isSuccess: boolean;
  isExpired: boolean;
  priceImpactCanProceed: boolean;
  priceImpactRequiresAck: boolean;
  priceImpactAcknowledged: boolean;
  tokenType: TokenType;
  mode: SwapMode;
  needsAggregator: boolean;
}): { label: string; disabled: boolean } {
  const {
    isConnected,
    isValidAmount,
    hasInsufficientBalance,
    hasInsufficientCollateral,
    isSwapping,
    isSuccess,
    isExpired,
    priceImpactCanProceed,
    priceImpactRequiresAck,
    priceImpactAcknowledged,
    tokenType,
    mode,
    needsAggregator,
  } = params;

  if (isSwapping) return { label: 'Swapping...', disabled: true };
  if (!isConnected) return { label: 'Connect Wallet', disabled: true };
  if (isExpired) return { label: 'Market Expired', disabled: true };
  if (!isValidAmount) return { label: 'Enter Amount', disabled: true };
  if (hasInsufficientBalance) return { label: 'Insufficient Balance', disabled: true };
  if (hasInsufficientCollateral) return { label: 'Insufficient Collateral', disabled: true };
  if (priceImpactRequiresAck && !priceImpactAcknowledged) {
    return { label: 'Acknowledge Price Impact', disabled: true };
  }
  if (isSuccess) return { label: 'Swapped!', disabled: true };
  if (!priceImpactCanProceed) return { label: 'Price Impact Too High', disabled: true };

  const action = mode === 'buy' ? 'Buy' : 'Sell';
  const via = needsAggregator ? ' via DEX' : '';
  return { label: `${action} ${tokenType}${via}`, disabled: false };
}

/**
 * Get transaction steps for the current swap direction with aggregator.
 */
function getTransactionSteps(
  tokenType: TokenType,
  mode: SwapMode,
  needsAggregator: boolean
): { label: string; description: string }[] {
  if (mode === 'buy') {
    if (needsAggregator) {
      return [
        { label: 'Approve Token', description: 'Approve input token to router' },
        { label: 'Swap via DEX', description: 'Swap token to underlying' },
        { label: `Get ${tokenType}`, description: `Receive ${tokenType} tokens` },
      ];
    }
    return [
      { label: 'Approve SY', description: 'Approve SY to router' },
      { label: 'Swap', description: `Swap SY for ${tokenType}` },
    ];
  }

  // Selling
  if (needsAggregator) {
    const steps = [
      { label: `Approve ${tokenType}`, description: `Approve ${tokenType} to router` },
    ];
    if (tokenType === 'YT') {
      steps.push({ label: 'Approve Collateral', description: 'Approve SY collateral' });
    }
    steps.push(
      { label: 'Swap via DEX', description: 'Swap underlying to output token' },
      { label: 'Receive Token', description: 'Receive output tokens' }
    );
    return steps;
  }

  if (tokenType === 'YT') {
    return [
      { label: 'Approve YT', description: 'Approve YT to router' },
      { label: 'Approve Collateral', description: 'Approve SY collateral' },
      { label: 'Swap', description: 'Swap YT for SY' },
    ];
  }
  return [
    { label: 'Approve PT', description: 'Approve PT to router' },
    { label: 'Swap', description: 'Swap PT for SY' },
  ];
}

// ============================================================================
// Component
// ============================================================================

/**
 * TokenAggregatorSwapForm - Swap form for arbitrary tokens to/from PT/YT
 *
 * This form allows users to swap tokens that aren't directly SY by routing
 * through DEX aggregators. The flow is:
 * - Buy: token_in -> aggregator -> underlying -> SY -> PT/YT
 * - Sell: PT/YT -> SY -> underlying -> aggregator -> token_out
 *
 * Features:
 * - Token selector dropdown for input/output token
 * - Aggregator routing display (when available)
 * - Two-step approval flow for aggregator swaps
 * - Combined slippage handling (aggregator + market)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-mode swap form with PT/YT toggle, buy/sell modes, aggregator routing, and price impact handling - inherent UI complexity
export function TokenAggregatorSwapForm({ market, className }: AggregatorSwapFormProps): ReactNode {
  const { isConnected, network } = useStarknet();
  const { address } = useAccount();

  // Get market info for underlying address
  const marketInfos = useMemo(() => getMarketInfos(network), [network]);
  const currentMarketInfo = useMemo(
    () => marketInfos.find((m) => m.marketAddress === market.address),
    [marketInfos, market.address]
  );

  // Build token list for this market
  const tokenList = useMemo(
    () => buildTokenList(market, market.syAddress, currentMarketInfo?.underlyingAddress),
    [market, currentMarketInfo]
  );

  // Form state
  const [tokenType, setTokenType] = useState<TokenType>('PT');
  const [mode, setMode] = useState<SwapMode>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState(
    tokenList[0]?.address ?? market.syAddress
  );
  const [slippageBps, setSlippageBps] = useState(100); // 1% default for aggregator swaps
  const [isFlipping, setIsFlipping] = useState(false);

  // Get selected token config
  const selectedToken = useMemo(
    () => tokenList.find((t) => t.address === selectedTokenAddress) ?? tokenList[0],
    [tokenList, selectedTokenAddress]
  );
  const needsAggregator = selectedToken?.isExternal ?? false;

  // Hooks for aggregator swaps
  const swapTokenForPt = useSwapTokenForPt();
  const swapPtForToken = useSwapPtForToken();
  const swapTokenForYt = useSwapTokenForYt();
  const swapYtForToken = useSwapYtForToken();

  // Determine which hook to use based on direction
  const activeSwapHook = useMemo(() => {
    if (mode === 'buy') {
      return tokenType === 'PT' ? swapTokenForPt : swapTokenForYt;
    }
    return tokenType === 'PT' ? swapPtForToken : swapYtForToken;
  }, [mode, tokenType, swapTokenForPt, swapPtForToken, swapTokenForYt, swapYtForToken]);

  const {
    isSwapping,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetSwap,
  } = activeSwapHook;

  // Derive input token address based on mode
  const inputTokenAddress = useMemo(() => {
    if (mode === 'buy') {
      return selectedTokenAddress;
    }
    // Selling PT/YT
    return tokenType === 'PT' ? market.ptAddress : market.ytAddress;
  }, [mode, selectedTokenAddress, tokenType, market]);

  // Token labels
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const inputLabel = useMemo(() => {
    if (mode === 'buy') {
      return selectedToken?.symbol ?? 'Token';
    }
    return tokenType === 'PT' ? `PT-${tokenSymbol}` : `YT-${tokenSymbol}`;
  }, [mode, selectedToken, tokenType, tokenSymbol]);

  // Output label - used for rate display (reserved for future use)
  const _outputLabel = useMemo(() => {
    if (mode === 'buy') {
      return tokenType === 'PT' ? `PT-${tokenSymbol}` : `YT-${tokenSymbol}`;
    }
    return selectedToken?.symbol ?? 'Token';
  }, [mode, selectedToken, tokenType, tokenSymbol]);
  void _outputLabel; // Will be used for rate display in future iteration

  // Fetch balances
  const { data: inputBalance } = useTokenBalance(inputTokenAddress);
  const { data: syBalance } = useTokenBalance(market.syAddress);

  // Price impact data - fetched for future historical comparison feature
  const { data: _priceImpactData } = usePriceImpact(market.address, { days: 30 });
  void _priceImpactData; // Will be used for historical impact comparison

  // Parse input amount
  const parsedInputAmount = useMemo(() => {
    if (!inputAmount || inputAmount === '') return BigInt(0);
    try {
      return parseWad(inputAmount);
    } catch {
      return BigInt(0);
    }
  }, [inputAmount]);
  const isValidAmount = parsedInputAmount > 0n;

  // Estimate output (simplified - in production would use aggregator quote API)
  // For now, assume 1:1 for SY swaps, with some slippage buffer for external tokens
  const expectedOutput = useMemo(() => {
    if (!isValidAmount) return BigInt(0);
    // Apply a conservative estimate - actual quote would come from aggregator
    const estimateFactor = needsAggregator ? 99n : 100n; // 1% buffer for aggregator
    return (parsedInputAmount * estimateFactor) / 100n;
  }, [parsedInputAmount, isValidAmount, needsAggregator]);

  // Calculate min output with slippage
  const minOutput = useMemo(() => {
    return calculateMinOutput(expectedOutput, slippageBps);
  }, [expectedOutput, slippageBps]);

  // Estimate price impact (simplified)
  const priceImpact = useMemo(() => {
    if (!isValidAmount || expectedOutput === BigInt(0)) return 0;
    const impact = Number(parsedInputAmount - expectedOutput) / Number(parsedInputAmount);
    return Math.max(0, impact * 100);
  }, [parsedInputAmount, expectedOutput, isValidAmount]);

  // Price impact warning
  const priceImpactWarning = usePriceImpactWarning(priceImpact);

  // Animated output display
  const numericOutput = useMemo(() => {
    const val = expectedOutput / BigInt(10 ** 12);
    return Number(val) / 10 ** 6;
  }, [expectedOutput]);
  const animatedOutput = useAnimatedNumber(numericOutput, { duration: 300, decimals: 6 });
  const formattedAnimatedOutput = useMemo(() => {
    if (animatedOutput === 0) return '0.00';
    return animatedOutput.toFixed(6).replace(/\.?0+$/, '');
  }, [animatedOutput]);

  // Validation
  const hasInsufficientBalance = inputBalance !== undefined && parsedInputAmount > inputBalance;

  // For selling YT, need SY collateral
  const collateralRequired =
    mode === 'sell' && tokenType === 'YT' ? parsedInputAmount * 4n : BigInt(0);
  const hasInsufficientCollateral =
    mode === 'sell' &&
    tokenType === 'YT' &&
    syBalance !== undefined &&
    collateralRequired > syBalance;

  const canSwap =
    isConnected &&
    isValidAmount &&
    !hasInsufficientBalance &&
    !hasInsufficientCollateral &&
    !isSwapping &&
    !isSuccess &&
    !market.isExpired &&
    priceImpactWarning.canProceed;

  // Button state
  const buttonState = useMemo(
    () =>
      deriveButtonState({
        isConnected,
        isValidAmount,
        hasInsufficientBalance,
        hasInsufficientCollateral,
        isSwapping,
        isSuccess,
        isExpired: market.isExpired,
        priceImpactCanProceed: priceImpactWarning.canProceed,
        priceImpactRequiresAck: priceImpactWarning.requiresAcknowledgment,
        priceImpactAcknowledged: priceImpactWarning.acknowledged,
        tokenType,
        mode,
        needsAggregator,
      }),
    [
      isConnected,
      isValidAmount,
      hasInsufficientBalance,
      hasInsufficientCollateral,
      isSwapping,
      isSuccess,
      market.isExpired,
      priceImpactWarning.canProceed,
      priceImpactWarning.requiresAcknowledgment,
      priceImpactWarning.acknowledged,
      tokenType,
      mode,
      needsAggregator,
    ]
  );

  // Transaction steps
  const transactionSteps = useMemo(
    () => getTransactionSteps(tokenType, mode, needsAggregator),
    [tokenType, mode, needsAggregator]
  );

  const currentStep = useMemo(() => {
    if (isSuccess) return transactionSteps.length;
    if (isSwapping) return transactionSteps.length - 1;
    return -1;
  }, [isSwapping, isSuccess, transactionSteps.length]);

  // Transaction status
  const txStatus = useMemo(() => {
    if (isSwapping) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isSwapping, isSuccess, isError]);

  // Gas estimation (simplified - would use actual calls in production)
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(null); // Pass null for now

  // Handlers
  const handleSwap = (): void => {
    if (!canSwap || !address) return;

    if (mode === 'buy') {
      const tokenInput: TokenInputType = {
        token: selectedTokenAddress,
        amount: parsedInputAmount,
        swap_data: EMPTY_SWAP_DATA,
      };

      if (tokenType === 'PT') {
        swapTokenForPt.swap({
          marketAddress: market.address,
          input: tokenInput,
          minPtOut: minOutput,
        });
      } else {
        swapTokenForYt.swap({
          ytAddress: market.ytAddress,
          marketAddress: market.address,
          input: tokenInput,
          minYtOut: minOutput,
        });
      }
    } else {
      // Selling PT/YT
      const tokenOutput: TokenOutput = {
        token: selectedTokenAddress,
        min_amount: minOutput,
        swap_data: EMPTY_SWAP_DATA,
      };

      if (tokenType === 'PT') {
        swapPtForToken.swap({
          marketAddress: market.address,
          ptAddress: market.ptAddress,
          exactPtIn: parsedInputAmount,
          output: tokenOutput,
        });
      } else {
        swapYtForToken.swap({
          ytAddress: market.ytAddress,
          syAddress: market.syAddress,
          marketAddress: market.address,
          exactYtIn: parsedInputAmount,
          maxSyCollateral: collateralRequired,
          output: tokenOutput,
        });
      }
    }
  };

  // Clear input on success
  useEffect(() => {
    if (isSuccess) {
      setInputAmount('');
    }
  }, [isSuccess]);

  // Handle direction toggle
  const toggleDirection = (): void => {
    setIsFlipping(true);
    setTimeout(() => {
      setMode((prev) => (prev === 'buy' ? 'sell' : 'buy'));
      setInputAmount('');
      resetSwap();
      priceImpactWarning.reset();
      setIsFlipping(false);
    }, 150);
  };

  // Handle token type change
  const handleTokenTypeChange = (newType: string): void => {
    if (newType !== 'PT' && newType !== 'YT') return;
    setTokenType(newType);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
    toast.success(`Switched to ${newType}`, {
      description:
        newType === 'PT'
          ? 'Principal Token – fixed yield at maturity'
          : 'Yield Token – leveraged yield exposure',
      duration: 2000,
    });
  };

  // Handle mode change
  const handleModeChange = (value: string): void => {
    if (value !== 'buy' && value !== 'sell') return;
    setMode(value);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
  };

  // Handle token selection change
  const handleTokenSelect = (value: string | null): void => {
    if (value === null) return; // Ignore null selections
    setSelectedTokenAddress(value);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
  };

  // UI state
  const formGradient = mode === 'buy' ? 'primary' : 'destructive';
  const showPriceImpactWarning = isValidAmount && priceImpactWarning.severity !== 'low';

  return (
    <FormLayout className={className} gradient={formGradient}>
      {/* Header: Token type + Mode toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup className="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={tokenType === 'PT'}
            onPressedChange={() => handleTokenTypeChange('PT')}
            className="data-[pressed]:bg-primary data-[pressed]:text-primary-foreground rounded-md px-4"
          >
            PT
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={tokenType === 'YT'}
            onPressedChange={() => handleTokenTypeChange('YT')}
            className="data-[pressed]:bg-chart-2 data-[pressed]:text-foreground rounded-md px-4"
          >
            YT
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup className="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={mode === 'buy'}
            onPressedChange={() => handleModeChange('buy')}
            className="data-[pressed]:bg-primary/20 data-[pressed]:text-primary rounded-md px-4"
          >
            Buy
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={mode === 'sell'}
            onPressedChange={() => handleModeChange('sell')}
            className="data-[pressed]:bg-destructive/20 data-[pressed]:text-destructive rounded-md px-4"
          >
            Sell
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Near-expiry warning */}
      {!market.isExpired && <NearExpiryWarning expiryTimestamp={market.expiry} context="swap" />}

      {/* Token selector for input (buy) or output (sell) */}
      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>{mode === 'buy' ? 'Pay with' : 'Receive'}</span>
          {needsAggregator && (
            <span className="bg-chart-4/10 text-chart-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
              <Zap className="h-3 w-3" />
              Via DEX
            </span>
          )}
        </div>
        <Select value={selectedTokenAddress} onValueChange={handleTokenSelect}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tokenList.map((token) => (
              <SelectItem key={token.address} value={token.address}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{token.symbol}</span>
                  {token.isExternal && <Zap className="text-chart-4 h-3 w-3" />}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You pay"
          tokenAddress={inputTokenAddress}
          tokenSymbol={inputLabel}
          value={inputAmount}
          onChange={setInputAmount}
          error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
        />
      </FormInputSection>

      {/* Swap direction button */}
      <FormDivider>
        <div className="bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleDirection}
            className={cn(
              'bg-background h-10 w-10 rounded-full shadow-lg transition-transform duration-300',
              isFlipping && 'rotate-180'
            )}
            aria-label="Toggle swap direction"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </FormDivider>

      {/* Output Preview */}
      <FormOutputSection>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground shrink-0 text-sm">You receive</span>
          <span className="text-muted-foreground truncate text-xs">
            Min: {formatWad(minOutput, 4)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums">
            {formattedAnimatedOutput}
          </span>
          <div
            className={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              mode === 'buy'
                ? tokenType === 'PT'
                  ? 'bg-primary/10'
                  : 'bg-chart-2/10'
                : 'bg-chart-1/10'
            )}
          >
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                mode === 'buy'
                  ? tokenType === 'PT'
                    ? 'text-primary'
                    : 'text-chart-2'
                  : 'text-chart-1'
              )}
            >
              {mode === 'buy' ? tokenType : (selectedToken?.symbol.slice(0, 4) ?? 'SY')}
            </span>
          </div>
        </div>
      </FormOutputSection>

      {/* Price Impact Meter */}
      {isValidAmount && <PriceImpactMeter impact={priceImpact} />}

      {/* Aggregator routing info */}
      {needsAggregator && isValidAmount && (
        <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3 text-sm">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="text-foreground font-medium">Route via DEX Aggregator</p>
            <p className="text-muted-foreground text-xs">
              Your {mode === 'buy' ? 'input' : 'output'} token will be swapped through a DEX
              aggregator to {mode === 'buy' ? 'enter' : 'exit'} the{' '}
              {tokenType === 'PT' ? 'Principal Token' : 'Yield Token'} position. Additional slippage
              is applied to account for aggregator routing.
            </p>
          </div>
        </div>
      )}

      {/* Price Impact Warning */}
      {showPriceImpactWarning && (
        <PriceImpactWarning
          priceImpact={priceImpact}
          onAcknowledge={priceImpactWarning.acknowledge}
          acknowledged={priceImpactWarning.acknowledged}
        />
      )}

      {/* Slippage Settings */}
      <div>
        <div className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
          Slippage Tolerance
          {needsAggregator && <span className="text-chart-4 text-xs">(includes DEX buffer)</span>}
        </div>
        <ToggleGroup className="flex gap-1">
          {SLIPPAGE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              pressed={slippageBps === option.value}
              onPressedChange={() => setSlippageBps(option.value)}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* YT Sell Collateral Warning */}
      {mode === 'sell' && tokenType === 'YT' && isValidAmount && (
        <div className="bg-warning/10 border-warning/20 rounded-lg border p-3">
          <p className="text-warning text-sm font-medium">Collateral Required</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Selling YT requires {formatWad(collateralRequired, 4)} SY as collateral.
            {syBalance !== undefined && (
              <span>
                {' '}
                Your balance: {formatWad(syBalance, 4)} SY
                {hasInsufficientCollateral && (
                  <span className="text-destructive"> (insufficient)</span>
                )}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Transaction Progress */}
      <TransactionProgress
        status={txStatus}
        transactionHash={transactionHash ?? null}
        error={error}
        steps={transactionSteps}
        currentStep={currentStep}
        gasEstimate={{
          formattedFee,
          formattedFeeUsd,
          isLoading: isEstimatingFee,
          error: feeError,
        }}
      />

      {/* Submit Button */}
      <FormActions>
        <Button
          onClick={handleSwap}
          disabled={buttonState.disabled}
          size="xl"
          className={cn(
            'w-full',
            mode === 'sell' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
          )}
        >
          {buttonState.label}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
