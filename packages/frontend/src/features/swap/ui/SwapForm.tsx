'use client';

import type { MarketData } from '@entities/market';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import {
  estimateImpact,
  PriceImpactWarning,
  usePriceImpact,
  usePriceImpactWarning,
} from '@features/price';
import {
  calculateMinOutput,
  type SwapPreviewDirection,
  useSwap,
  useSwapPreview,
} from '@features/swap';
import {
  buildSwapCalls,
  calculateSwapQuote,
  deriveButtonState,
  deriveImpliedApyDisplay,
  deriveOutputBadgeStyle,
  deriveSwapDirection,
  deriveSwapFormUiState,
  deriveTokenLabels,
  getInputTokenAddress,
  getTokenTypeDescription,
  getTransactionSteps,
  isValidBuySell,
  isValidTokenType,
  type TokenType,
} from '@features/swap/lib/swapFormLogic';
import { PriceImpactMeter } from '@features/swap/ui/PriceImpactMeter';
import { SwapDetails } from '@features/swap/ui/SwapDetails';
import { TransactionProgress } from '@features/swap/ui/TransactionProgress';
import { YtCollateralWarning } from '@features/swap/ui/YtCollateralWarning';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses, getMarketParams } from '@shared/config/addresses';
import { useEstimateFee } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { type MarketState as AmmMarketState, getImpliedApy } from '@shared/math/amm';
import { formatWad, fromWad, parseWad } from '@shared/math/wad';
// Note: Some imports moved to SwapDetails component
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
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { ArrowUpDown } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface SwapFormProps {
  market: MarketData;
  className?: string | undefined;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

/**
 * SwapForm - Enhanced with visual hierarchy and micro-interactions
 *
 * Features:
 * - Inline token type + direction toggles
 * - Visual direction indicator with animated swap button
 * - Price impact meter with color-coded severity
 * - Collapsible swap details
 * - Directional background gradient
 */
export function SwapForm({ market, className }: SwapFormProps): ReactNode {
  const { isConnected, network } = useStarknet();
  const { address } = useAccount();
  const addresses = getAddresses(network);
  const [tokenType, setTokenType] = useState<TokenType>('PT');
  const [isBuying, setIsBuying] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [isFlipping, setIsFlipping] = useState(false);
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default

  // Derive swap direction from token type and buy/sell (lookup table)
  const direction = deriveSwapDirection(tokenType, isBuying);

  const {
    swap,
    isSwapping,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetSwap,
  } = useSwap();

  // Derive token labels and addresses using pure functions
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenLabels = useMemo(
    () => deriveTokenLabels(tokenSymbol, tokenType, isBuying),
    [tokenSymbol, tokenType, isBuying]
  );
  const inputToken = getInputTokenAddress(market, tokenType, isBuying);
  const { input: inputLabel, output: outputLabel, sy: syLabel } = tokenLabels;

  // Fetch balance for input token
  const { data: inputBalance } = useTokenBalance(inputToken);

  // For selling YT, we also need SY balance for collateral
  const { data: syBalance } = useTokenBalance(market.syAddress);

  // Fetch historical price impact data for the market
  const { data: priceImpactData } = usePriceImpact(market.address, { days: 30 });

  // Get market params for AMM calculations
  const marketParams = useMemo(() => getMarketParams(network), [network]);

  // Parse input amount and validate
  const parsedInputAmount = useMemo(() => {
    if (!inputAmount || inputAmount === '') return BigInt(0);
    try {
      return parseWad(inputAmount);
    } catch {
      return BigInt(0);
    }
  }, [inputAmount]);
  const isValidAmount = parsedInputAmount > 0n;

  // Build AMM market state for accurate calculations
  const ammState: AmmMarketState = useMemo(
    () => ({
      syReserve: market.state.syReserve,
      ptReserve: market.state.ptReserve,
      totalLp: market.state.totalLpSupply,
      scalarRoot: marketParams.scalarRoot,
      initialAnchor: market.metadata?.initialAnchor ?? market.state.lnImpliedRate,
      feeRate: marketParams.feeRate,
      expiry: BigInt(market.expiry),
      lastLnImpliedRate: market.state.lnImpliedRate,
    }),
    [market.state, market.expiry, market.metadata?.initialAnchor, marketParams]
  );

  // Calculate swap quote using extracted pure function
  const swapResult = useMemo(
    () => calculateSwapQuote(direction, ammState, parsedInputAmount),
    [direction, ammState, parsedInputAmount]
  );

  // Extract values from swap result
  const expectedOutput = swapResult?.amountOut ?? BigInt(0);
  const priceImpact = swapResult?.priceImpact ?? 0;

  // Map swap direction to preview direction (only available for PT swaps)
  const previewDirection = useMemo((): SwapPreviewDirection | null => {
    switch (direction) {
      case 'buy_pt':
        return 'sy_for_pt';
      case 'sell_pt':
        return 'pt_for_sy';
      default:
        // YT swaps don't have RouterStatic preview functions
        return null;
    }
  }, [direction]);

  // On-chain preview from RouterStatic (only for PT swaps)
  const { data: previewResult, isLoading: isPreviewLoading } = useSwapPreview(
    market.address,
    parsedInputAmount,
    previewDirection ?? 'sy_for_pt', // Fallback doesn't matter since enabled=false for YT
    { enabled: previewDirection !== null && isValidAmount }
  );

  // Preview is only available for PT swaps when RouterStatic is deployed
  const isPreviewAvailable = previewDirection !== null;

  // Animate output for Change Blindness prevention (UI/UX Law)
  const numericOutput = useMemo(() => fromWad(expectedOutput).toNumber(), [expectedOutput]);
  const animatedOutput = useAnimatedNumber(numericOutput, { duration: 300, decimals: 6 });
  const formattedAnimatedOutput = useMemo(() => {
    if (animatedOutput === 0) return '0.000000';
    const formatted = animatedOutput.toFixed(6);
    const parts = formatted.split('.');
    const intPart = parts[0] ?? '0';
    const decPart = parts[1];
    if (decPart !== undefined) {
      const trimmed = decPart.replace(/0+$/, '').padEnd(2, '0');
      return `${intPart}.${trimmed}`;
    }
    return formatted;
  }, [animatedOutput]);

  // Price impact warning management
  const priceImpactWarning = usePriceImpactWarning(priceImpact);

  // Calculate implied APY change and derive display properties
  const impliedApyBefore = getImpliedApy(market.state.lnImpliedRate);
  const impliedApyAfter = swapResult
    ? getImpliedApy(swapResult.newLnImpliedRate)
    : impliedApyBefore;

  // Pre-compute view models to simplify JSX
  const outputBadgeStyle = useMemo(
    () => deriveOutputBadgeStyle(tokenType, isBuying),
    [tokenType, isBuying]
  );

  const impliedApyDisplay = useMemo(
    () => deriveImpliedApyDisplay(direction, impliedApyBefore, impliedApyAfter, isValidAmount),
    [direction, impliedApyBefore, impliedApyAfter, isValidAmount]
  );

  // Estimate historical average impact for this trade size
  const historicalAvgImpact = useMemo(() => {
    if (!priceImpactData?.impactBySize || parsedInputAmount === BigInt(0)) return null;
    return estimateImpact(parsedInputAmount, priceImpactData.impactBySize);
  }, [priceImpactData?.impactBySize, parsedInputAmount]);

  // Calculate minimum output with slippage
  const minOutput = useMemo(() => {
    return calculateMinOutput(expectedOutput, slippageBps);
  }, [expectedOutput, slippageBps]);

  // Build swap calls for gas estimation using extracted pure function
  const swapCalls = useMemo(
    () =>
      buildSwapCalls({
        direction,
        market,
        routerAddress: addresses.router,
        userAddress: address ?? '',
        inputAmount: parsedInputAmount,
        minOutput,
      }),
    [address, parsedInputAmount, minOutput, direction, market, addresses.router]
  );

  // Estimate gas fee for the swap
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(swapCalls);

  // Validation
  const hasInsufficientBalance = inputBalance !== undefined && parsedInputAmount > inputBalance;

  // For selling YT, check collateral requirement (4x the YT amount)
  const collateralRequired = direction === 'sell_yt' ? parsedInputAmount * BigInt(4) : BigInt(0);
  const hasInsufficientCollateral =
    direction === 'sell_yt' && syBalance !== undefined && collateralRequired > syBalance;

  const canSwap =
    isConnected &&
    isValidAmount &&
    !hasInsufficientBalance &&
    !hasInsufficientCollateral &&
    !isSwapping &&
    !isSuccess &&
    !market.isExpired && // Gap 4: Pre-flight validation for expired markets
    priceImpactWarning.canProceed;

  // Pre-computed UI state using extracted pure function
  const uiState = useMemo(
    () =>
      deriveSwapFormUiState({
        isBuying,
        hasInsufficientBalance,
        isFlipping,
        isValidAmount,
        priceImpactSeverity: priceImpactWarning.severity,
        direction,
      }),
    [
      isBuying,
      hasInsufficientBalance,
      isFlipping,
      isValidAmount,
      priceImpactWarning.severity,
      direction,
    ]
  );

  // Derive button state using guard pattern (replaces nested ternaries)
  const buttonState = useMemo(
    () =>
      deriveButtonState({
        state: {
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
        },
        tokenType,
        isBuying,
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
      isBuying,
    ]
  );

  // Determine transaction status
  const txStatus = useMemo(() => {
    if (isSwapping) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isSwapping, isSuccess, isError]);

  // Transaction steps for StepProgress (lookup table)
  const transactionSteps = useMemo(() => getTransactionSteps(direction), [direction]);

  // Calculate current step based on transaction state
  const currentStep = useMemo(() => {
    if (isSuccess) return transactionSteps.length; // All complete
    if (isSwapping) return transactionSteps.length - 1; // Show last step as active
    return -1; // No transaction in progress
  }, [isSwapping, isSuccess, transactionSteps.length]);

  // Handle swap
  const handleSwap = (): void => {
    if (!canSwap) return;

    swap({
      marketAddress: market.address,
      syAddress: market.syAddress,
      ptAddress: market.ptAddress,
      ytAddress: market.ytAddress,
      direction,
      amountIn: parsedInputAmount,
      minAmountOut: minOutput,
    });
  };

  // Clear input on success
  useEffect(() => {
    if (isSuccess) {
      setInputAmount('');
    }
  }, [isSuccess]);

  // Handle direction change with animation
  const toggleDirection = (): void => {
    setIsFlipping(true);
    setTimeout(() => {
      setIsBuying((prev) => !prev);
      setInputAmount('');
      resetSwap();
      priceImpactWarning.reset();
      setIsFlipping(false);
    }, 150);
  };

  // Handle token type change with confirmation feedback
  const handleTokenTypeChange = (newType: string): void => {
    if (!isValidTokenType(newType)) return;
    setTokenType(newType);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
    toast.success(`Switched to ${newType}`, {
      description: getTokenTypeDescription(newType),
      duration: 2000,
    });
  };

  // Handle buy/sell change with confirmation feedback
  const handleDirectionChange = (value: string): void => {
    if (!isValidBuySell(value)) return;
    const buying = value === 'buy';
    setIsBuying(buying);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
    const dirLabel = buying ? 'Buy mode' : 'Sell mode';
    const description = buying
      ? `Pay SY to receive ${tokenType}`
      : `Pay ${tokenType} to receive SY`;
    toast.success(dirLabel, { description, duration: 2000 });
  };

  return (
    <FormLayout className={className} gradient={uiState.formGradient}>
      {/* Token type + direction as inline pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup className="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={tokenType === 'PT'}
            onPressedChange={() => {
              handleTokenTypeChange('PT');
            }}
            className="data-[pressed]:bg-primary data-[pressed]:text-primary-foreground rounded-md px-4"
          >
            PT
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={tokenType === 'YT'}
            onPressedChange={() => {
              handleTokenTypeChange('YT');
            }}
            className="data-[pressed]:bg-chart-2 data-[pressed]:text-foreground rounded-md px-4"
          >
            YT
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup className="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={isBuying}
            onPressedChange={() => {
              handleDirectionChange('buy');
            }}
            className="data-[pressed]:bg-primary/20 data-[pressed]:text-primary rounded-md px-4"
          >
            Buy
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={!isBuying}
            onPressedChange={() => {
              handleDirectionChange('sell');
            }}
            className="data-[pressed]:bg-destructive/20 data-[pressed]:text-destructive rounded-md px-4"
          >
            Sell
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Near-expiry warning banner */}
      {!market.isExpired && <NearExpiryWarning expiryTimestamp={market.expiry} context="swap" />}

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You pay"
          tokenAddress={inputToken}
          tokenSymbol={inputLabel}
          value={inputAmount}
          onChange={setInputAmount}
          error={uiState.inputError}
        />
      </FormInputSection>

      {/* Animated swap direction button */}
      <FormDivider>
        <div className="bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleDirection}
            className={cn(
              'bg-background h-10 w-10 rounded-full shadow-lg transition-transform duration-300',
              uiState.flipButtonClass
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
          {/* Token badge - using pre-computed styles */}
          <div
            className={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              outputBadgeStyle.containerClass
            )}
          >
            <span className={cn('font-mono text-sm font-semibold', outputBadgeStyle.textClass)}>
              {outputBadgeStyle.displayText}
            </span>
          </div>
        </div>
      </FormOutputSection>

      {/* Price Impact Meter */}
      {isValidAmount && <PriceImpactMeter impact={priceImpact} />}

      {/* Swap Details (extracted component) */}
      <SwapDetails
        inputLabel={inputLabel}
        outputLabel={outputLabel}
        syLabel={syLabel}
        parsedInputAmount={parsedInputAmount}
        expectedOutput={expectedOutput}
        isValidAmount={isValidAmount}
        impliedApyDisplay={impliedApyDisplay}
        historicalAvgImpact={historicalAvgImpact}
        slippageBps={slippageBps}
        swapResult={swapResult}
        reserveFeePercent={market.state.reserveFeePercent}
        formattedFee={formattedFee}
        formattedFeeUsd={formattedFeeUsd}
        isEstimatingFee={isEstimatingFee}
        feeError={feeError}
        previewResult={previewResult}
        isPreviewLoading={isPreviewLoading}
        isPreviewAvailable={isPreviewAvailable}
      />

      {/* Price Impact Warning */}
      {uiState.showPriceImpactWarning && (
        <PriceImpactWarning
          priceImpact={priceImpact}
          onAcknowledge={priceImpactWarning.acknowledge}
          acknowledged={priceImpactWarning.acknowledged}
        />
      )}

      {/* Slippage Settings */}
      <div>
        <div className="text-muted-foreground mb-2 text-sm">Slippage Tolerance</div>
        <ToggleGroup className="flex gap-1">
          {SLIPPAGE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              pressed={slippageBps === option.value}
              onPressedChange={() => {
                setSlippageBps(option.value);
              }}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* YT Sell Collateral Warning (extracted component) */}
      <YtCollateralWarning
        show={uiState.showYtCollateralWarning}
        collateralRequired={collateralRequired}
        syBalance={syBalance}
        syLabel={syLabel}
      />

      {/* Transaction Progress (extracted component) */}
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
          className={cn('w-full', uiState.sellButtonClass)}
        >
          {buttonState.label}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
