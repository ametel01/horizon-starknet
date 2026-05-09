'use client';

import type { MarketData } from '@entities/market';
import {
  buildAddLiquiditySingleTokenCalls,
  buildAddLiquiditySingleTokenKeepYtCalls,
  buildRemoveLiquiditySingleTokenCalls,
  useAddLiquiditySingleToken,
  useAddLiquiditySingleTokenKeepYt,
  useRemoveLiquiditySingleToken,
} from '@features/liquidity';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import type { SwapData, TokenInput as TokenInputType, TokenOutput } from '@features/swap';
import { TransactionProgress } from '@features/swap/ui/TransactionProgress';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses, getMarketInfos } from '@shared/config/addresses';
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
import { Switch } from '@shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { ArrowUpDown, Info, Zap } from 'lucide-react';
import { type ReactNode, useMemo, useReducer, useState } from 'react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type OperationMode = 'add' | 'remove';

interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  /** Whether this token requires aggregator swap (not SY) */
  isExternal: boolean;
}

interface TokenAggregatorLiquidityFormProps {
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
  isProcessing: boolean;
  isSuccess: boolean;
  isExpired: boolean;
  mode: OperationMode;
  needsAggregator: boolean;
  keepYt: boolean;
}): { label: string; disabled: boolean } {
  const {
    isConnected,
    isValidAmount,
    hasInsufficientBalance,
    isProcessing,
    isSuccess,
    isExpired,
    mode,
    needsAggregator,
    keepYt,
  } = params;

  if (isProcessing) {
    return {
      label: mode === 'add' ? 'Adding Liquidity...' : 'Removing Liquidity...',
      disabled: true,
    };
  }
  if (!isConnected) return { label: 'Connect Wallet', disabled: true };
  if (isExpired && mode === 'add') return { label: 'Market Expired', disabled: true };
  if (!isValidAmount) return { label: 'Enter Amount', disabled: true };
  if (hasInsufficientBalance) return { label: 'Insufficient Balance', disabled: true };
  if (isSuccess) {
    return { label: mode === 'add' ? 'Liquidity Added!' : 'Liquidity Removed!', disabled: true };
  }

  const via = needsAggregator ? ' via DEX' : '';
  const ytSuffix = keepYt && mode === 'add' ? ' (Keep YT)' : '';
  return {
    label: mode === 'add' ? `Add Liquidity${via}${ytSuffix}` : `Remove Liquidity${via}`,
    disabled: false,
  };
}

/**
 * Get transaction steps for the current operation with aggregator.
 */
function getTransactionSteps(
  mode: OperationMode,
  needsAggregator: boolean,
  keepYt: boolean
): { label: string; description: string }[] {
  if (mode === 'add') {
    if (needsAggregator) {
      const steps = [
        { label: 'Approve Token', description: 'Approve input token to router' },
        { label: 'Swap via DEX', description: 'Swap token to underlying' },
        { label: 'Add Liquidity', description: 'Deposit into pool' },
      ];
      if (keepYt) {
        steps.push({ label: 'Receive YT', description: 'Receive YT tokens' });
      }
      return steps;
    }
    return [
      { label: 'Approve SY', description: 'Approve SY to router' },
      { label: 'Add Liquidity', description: 'Deposit into pool' },
    ];
  }

  // Removing liquidity
  if (needsAggregator) {
    return [
      { label: 'Approve LP', description: 'Approve LP tokens to router' },
      { label: 'Remove Liquidity', description: 'Withdraw from pool' },
      { label: 'Swap via DEX', description: 'Swap to output token' },
    ];
  }

  return [
    { label: 'Approve LP', description: 'Approve LP tokens to router' },
    { label: 'Remove Liquidity', description: 'Withdraw from pool' },
  ];
}

// ============================================================================
// Component
// ============================================================================

/**
 * TokenAggregatorLiquidityForm - Liquidity form for arbitrary tokens
 *
 * This form allows users to add/remove liquidity using tokens that aren't
 * directly SY by routing through DEX aggregators. The flow is:
 * - Add: token_in -> aggregator -> underlying -> SY -> add liquidity
 * - Add (Keep YT): token_in -> aggregator -> underlying -> SY -> mint PT+YT -> add liquidity -> keep YT
 * - Remove: LP -> remove liquidity -> SY -> underlying -> aggregator -> token_out
 *
 * Features:
 * - Token selector dropdown for input/output token
 * - Option to keep YT when adding liquidity (yield speculation)
 * - Aggregator routing display (when available)
 * - Combined slippage handling (aggregator + market)
 */
export function TokenAggregatorLiquidityForm(props: TokenAggregatorLiquidityFormProps): ReactNode {
  return useTokenAggregatorLiquidityFormContent(props);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-mode form with add/remove liquidity, keep YT toggle, and aggregator routing - inherent UI complexity
function useTokenAggregatorLiquidityFormContent({
  market,
  className,
}: TokenAggregatorLiquidityFormProps): ReactNode {
  const { isConnected, network } = useStarknet();
  const { address } = useAccount();
  const addresses = getAddresses(network);

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
  const [mode, setMode] = useState<OperationMode>('add');
  const [inputAmount, setInputAmount] = useReducer((_current: string, next: string) => next, '');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState(
    tokenList[0]?.address ?? market.syAddress
  );
  const [slippageBps, setSlippageBps] = useState(100); // 1% default for aggregator swaps
  const [keepYt, setKeepYt] = useState(false);
  const [isFlipping, setIsFlipping] = useReducer((_current: boolean, next: boolean) => next, false);

  // Get selected token config
  const selectedToken = useMemo(
    () => tokenList.find((t) => t.address === selectedTokenAddress) ?? tokenList[0],
    [tokenList, selectedTokenAddress]
  );
  const needsAggregator = selectedToken?.isExternal ?? false;

  // Hooks for token liquidity operations
  const addLiquiditySingleToken = useAddLiquiditySingleToken();
  const addLiquiditySingleTokenKeepYt = useAddLiquiditySingleTokenKeepYt();
  const removeLiquiditySingleToken = useRemoveLiquiditySingleToken();

  // Extract common state from active hook
  const isProcessing = useMemo(() => {
    if (mode === 'add') {
      return keepYt ? addLiquiditySingleTokenKeepYt.isAdding : addLiquiditySingleToken.isAdding;
    }
    return removeLiquiditySingleToken.isRemoving;
  }, [
    mode,
    keepYt,
    addLiquiditySingleToken,
    addLiquiditySingleTokenKeepYt,
    removeLiquiditySingleToken,
  ]);

  const isSuccess = useMemo(() => {
    if (mode === 'add') {
      return keepYt ? addLiquiditySingleTokenKeepYt.isSuccess : addLiquiditySingleToken.isSuccess;
    }
    return removeLiquiditySingleToken.isSuccess;
  }, [
    mode,
    keepYt,
    addLiquiditySingleToken,
    addLiquiditySingleTokenKeepYt,
    removeLiquiditySingleToken,
  ]);

  const isError = useMemo(() => {
    if (mode === 'add') {
      return keepYt ? addLiquiditySingleTokenKeepYt.isError : addLiquiditySingleToken.isError;
    }
    return removeLiquiditySingleToken.isError;
  }, [
    mode,
    keepYt,
    addLiquiditySingleToken,
    addLiquiditySingleTokenKeepYt,
    removeLiquiditySingleToken,
  ]);

  const error = useMemo(() => {
    if (mode === 'add') {
      return keepYt ? addLiquiditySingleTokenKeepYt.error : addLiquiditySingleToken.error;
    }
    return removeLiquiditySingleToken.error;
  }, [
    mode,
    keepYt,
    addLiquiditySingleToken,
    addLiquiditySingleTokenKeepYt,
    removeLiquiditySingleToken,
  ]);

  const transactionHash = useMemo(() => {
    if (mode === 'add') {
      return keepYt
        ? addLiquiditySingleTokenKeepYt.transactionHash
        : addLiquiditySingleToken.transactionHash;
    }
    return removeLiquiditySingleToken.transactionHash;
  }, [
    mode,
    keepYt,
    addLiquiditySingleToken,
    addLiquiditySingleTokenKeepYt,
    removeLiquiditySingleToken,
  ]);

  const resetHook = useMemo(() => {
    if (mode === 'add') {
      return keepYt ? addLiquiditySingleTokenKeepYt.reset : addLiquiditySingleToken.reset;
    }
    return removeLiquiditySingleToken.reset;
  }, [
    mode,
    keepYt,
    addLiquiditySingleToken,
    addLiquiditySingleTokenKeepYt,
    removeLiquiditySingleToken,
  ]);

  // Derive input token address based on mode
  const inputTokenAddress = useMemo(() => {
    if (mode === 'add') {
      return selectedTokenAddress;
    }
    // Removing: input is LP token
    return market.address;
  }, [mode, selectedTokenAddress, market.address]);

  // Token labels
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const inputLabel = useMemo(() => {
    if (mode === 'add') {
      return selectedToken?.symbol ?? 'Token';
    }
    return `LP-${tokenSymbol}`;
  }, [mode, selectedToken, tokenSymbol]);

  // Output label for display
  const outputLabel = useMemo(() => {
    if (mode === 'add') {
      return keepYt ? `LP + YT-${tokenSymbol}` : `LP-${tokenSymbol}`;
    }
    return selectedToken?.symbol ?? 'Token';
  }, [mode, keepYt, selectedToken, tokenSymbol]);

  // Fetch balances
  const { data: inputBalance } = useTokenBalance(inputTokenAddress);

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
  // For now, assume 1:1 for SY operations, with some slippage buffer for external tokens
  const expectedOutput = useMemo(() => {
    if (!isValidAmount) return BigInt(0);
    // Apply a conservative estimate - actual quote would come from aggregator
    const estimateFactor = needsAggregator ? 98n : 100n; // 2% buffer for aggregator
    return (parsedInputAmount * estimateFactor) / 100n;
  }, [parsedInputAmount, isValidAmount, needsAggregator]);

  // Calculate min output with slippage
  const minOutput = useMemo(() => {
    return (expectedOutput * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [expectedOutput, slippageBps]);

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

  // Build calls for gas estimation
  const estimateCalls = useMemo(() => {
    if (!address || parsedInputAmount === 0n) return null;

    try {
      if (mode === 'add') {
        const tokenInput: TokenInputType = {
          token: selectedTokenAddress,
          amount: parsedInputAmount,
          swap_data: EMPTY_SWAP_DATA,
        };

        if (keepYt) {
          return buildAddLiquiditySingleTokenKeepYtCalls(addresses.router, address, {
            marketAddress: market.address,
            ytAddress: market.ytAddress,
            input: tokenInput,
            minLpOut: minOutput,
            minYtOut: minOutput, // Simplified - in production would calculate properly
          });
        }
        return buildAddLiquiditySingleTokenCalls(addresses.router, address, {
          marketAddress: market.address,
          input: tokenInput,
          minLpOut: minOutput,
        });
      }

      // Remove liquidity
      const tokenOutput: TokenOutput = {
        token: selectedTokenAddress,
        min_amount: minOutput,
        swap_data: EMPTY_SWAP_DATA,
      };

      return buildRemoveLiquiditySingleTokenCalls(addresses.router, address, {
        marketAddress: market.address,
        lpToBurn: parsedInputAmount,
        output: tokenOutput,
      });
    } catch {
      return null;
    }
  }, [
    address,
    addresses.router,
    market.address,
    market.ytAddress,
    mode,
    keepYt,
    selectedTokenAddress,
    parsedInputAmount,
    minOutput,
  ]);

  // Gas estimation
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(estimateCalls);

  // Validation
  const hasInsufficientBalance = inputBalance !== undefined && parsedInputAmount > inputBalance;

  const canExecute =
    isConnected &&
    isValidAmount &&
    !hasInsufficientBalance &&
    !isProcessing &&
    !isSuccess &&
    !(market.isExpired && mode === 'add');

  // Button state
  const buttonState = useMemo(
    () =>
      deriveButtonState({
        isConnected,
        isValidAmount,
        hasInsufficientBalance,
        isProcessing,
        isSuccess,
        isExpired: market.isExpired,
        mode,
        needsAggregator,
        keepYt,
      }),
    [
      isConnected,
      isValidAmount,
      hasInsufficientBalance,
      isProcessing,
      isSuccess,
      market.isExpired,
      mode,
      needsAggregator,
      keepYt,
    ]
  );

  // Transaction steps
  const transactionSteps = useMemo(
    () => getTransactionSteps(mode, needsAggregator, keepYt),
    [mode, needsAggregator, keepYt]
  );

  const currentStep = useMemo(() => {
    if (isSuccess) return transactionSteps.length;
    if (isProcessing) return transactionSteps.length - 1;
    return -1;
  }, [isProcessing, isSuccess, transactionSteps.length]);

  // Transaction status
  const txStatus = useMemo(() => {
    if (isProcessing) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isProcessing, isSuccess, isError]);

  // Handlers
  const handleExecute = async (): Promise<void> => {
    if (!canExecute || !address) return;

    if (mode === 'add') {
      const tokenInput: TokenInputType = {
        token: selectedTokenAddress,
        amount: parsedInputAmount,
        swap_data: EMPTY_SWAP_DATA,
      };

      if (keepYt) {
        await addLiquiditySingleTokenKeepYt.addLiquidityKeepYtAsync({
          marketAddress: market.address,
          ytAddress: market.ytAddress,
          input: tokenInput,
          minLpOut: minOutput,
          minYtOut: minOutput, // Simplified
        });
      } else {
        await addLiquiditySingleToken.addLiquidityAsync({
          marketAddress: market.address,
          input: tokenInput,
          minLpOut: minOutput,
        });
      }
    } else {
      // Remove liquidity
      const tokenOutput: TokenOutput = {
        token: selectedTokenAddress,
        min_amount: minOutput,
        swap_data: EMPTY_SWAP_DATA,
      };

      await removeLiquiditySingleToken.removeLiquidityAsync({
        marketAddress: market.address,
        lpToBurn: parsedInputAmount,
        output: tokenOutput,
      });
    }
    setInputAmount('');
  };

  // Handle direction toggle
  const toggleDirection = (): void => {
    setIsFlipping(true);
    setTimeout(() => {
      setMode((prev) => (prev === 'add' ? 'remove' : 'add'));
      setInputAmount('');
      resetHook();
      setIsFlipping(false);
    }, 150);
  };

  // Handle mode change
  const handleModeChange = (value: string): void => {
    if (value !== 'add' && value !== 'remove') return;
    setMode(value);
    setInputAmount('');
    resetHook();
  };

  // Handle token selection change
  const handleTokenSelect = (value: string | null): void => {
    if (value === null) return; // Ignore null selections
    setSelectedTokenAddress(value);
    setInputAmount('');
    resetHook();
  };

  // Handle keepYt toggle
  const handleKeepYtChange = (checked: boolean): void => {
    setKeepYt(checked);
    toast.success(checked ? 'Keep YT enabled' : 'Keep YT disabled', {
      description: checked
        ? 'You will receive LP tokens and keep YT for yield speculation'
        : 'Standard liquidity provision mode',
      duration: 2000,
    });
  };

  // UI state
  const formGradient = mode === 'add' ? 'primary' : 'destructive';

  return (
    <FormLayout className={className} gradient={formGradient}>
      {/* Header: Mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup className="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={mode === 'add'}
            onPressedChange={() => handleModeChange('add')}
            className="data-[pressed]:bg-primary/20 data-[pressed]:text-primary rounded-md px-4"
          >
            Add
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={mode === 'remove'}
            onPressedChange={() => handleModeChange('remove')}
            className="data-[pressed]:bg-destructive/20 data-[pressed]:text-destructive rounded-md px-4"
          >
            Remove
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Keep YT toggle - only for add mode */}
        {mode === 'add' && (
          <div className="flex items-center gap-2">
            <Switch checked={keepYt} onCheckedChange={handleKeepYtChange} />
            <span className="text-muted-foreground text-sm">Keep YT</span>
          </div>
        )}
      </div>

      {/* Near-expiry warning - only for add mode */}
      {mode === 'add' && !market.isExpired && (
        <NearExpiryWarning expiryTimestamp={market.expiry} context="swap" />
      )}

      {/* Token selector for input (add) or output (remove) */}
      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>{mode === 'add' ? 'Deposit with' : 'Receive'}</span>
          {needsAggregator && (
            <span className="bg-chart-4/10 text-chart-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
              <Zap className="size-3" />
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
                  {token.isExternal && <Zap className="text-chart-4 size-3" />}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label={mode === 'add' ? 'You deposit' : 'LP to remove'}
          tokenAddress={inputTokenAddress}
          tokenSymbol={inputLabel}
          value={inputAmount}
          onChange={setInputAmount}
          error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
        />
      </FormInputSection>

      {/* Direction toggle button */}
      <FormDivider>
        <div className="bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleDirection}
            className={cn(
              'bg-background size-10 rounded-full shadow-lg transition-transform duration-300',
              isFlipping && 'rotate-180'
            )}
            aria-label="Toggle operation direction"
          >
            <ArrowUpDown className="size-4" />
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
              mode === 'add' ? 'bg-primary/10' : 'bg-chart-1/10'
            )}
          >
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                mode === 'add' ? 'text-primary' : 'text-chart-1'
              )}
            >
              {outputLabel.slice(0, 8)}
            </span>
          </div>
        </div>
      </FormOutputSection>

      {/* Keep YT info when enabled */}
      {mode === 'add' && keepYt && isValidAmount && (
        <div className="bg-chart-2/10 border-chart-2/20 rounded-lg border p-3">
          <p className="text-chart-2 text-sm font-medium">Keep YT Mode</p>
          <p className="text-muted-foreground mt-1 text-xs">
            You will receive LP tokens plus YT tokens. The YT tokens give you leveraged exposure to
            the underlying yield. Use this if you want to speculate on higher yields.
          </p>
        </div>
      )}

      {/* Aggregator routing info */}
      {needsAggregator && isValidAmount && (
        <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3 text-sm">
          <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="text-foreground font-medium">Route via DEX Aggregator</p>
            <p className="text-muted-foreground text-xs">
              Your {mode === 'add' ? 'deposit' : 'withdrawal'} will be routed through a DEX
              aggregator to convert between your token and the pool's base token. Additional
              slippage is applied to account for aggregator routing.
            </p>
          </div>
        </div>
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
          onClick={handleExecute}
          disabled={buttonState.disabled}
          size="xl"
          className={cn(
            'w-full',
            mode === 'remove' &&
              'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
          )}
        >
          {buttonState.label}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
