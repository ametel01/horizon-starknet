'use client';

import BigNumber from 'bignumber.js';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import {
  PriceImpactWarning,
  usePriceImpactWarning,
  usePriceImpact,
  estimateImpact,
} from '@features/price';
import { calculateMinOutput, type SwapDirection, useSwap } from '@features/swap';
import { PriceImpactMeter } from '@features/swap/ui/PriceImpactMeter';
import { TransactionSettingsPanel, useTransactionSettings } from '@features/tx-settings';
import { useStarknet } from '@features/wallet';
import { getMarketParams } from '@shared/config/addresses';
import { cn } from '@shared/lib/utils';
import {
  calcSwapExactPtForSy,
  calcSwapExactSyForPt,
  calcSwapSyForExactPt,
  getImpliedApy,
  type MarketState as AmmMarketState,
  type SwapResult,
} from '@shared/math/amm';
import { formatWad, parseWad, WAD_BIGINT } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/Collapsible';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { TxStatus } from '@widgets/display/TxStatus';

interface SwapFormProps {
  market: MarketData;
  className?: string | undefined;
}

type TokenType = 'PT' | 'YT';

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
  const { slippageBps, slippagePercent } = useTransactionSettings();
  const [tokenType, setTokenType] = useState<TokenType>('PT');
  const [isBuying, setIsBuying] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [isFlipping, setIsFlipping] = useState(false);

  // Derive swap direction from token type and buy/sell
  const direction: SwapDirection = isBuying
    ? tokenType === 'PT'
      ? 'buy_pt'
      : 'buy_yt'
    : tokenType === 'PT'
      ? 'sell_pt'
      : 'sell_yt';

  const {
    swap,
    isSwapping,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetSwap,
  } = useSwap();

  // Get token symbol from metadata
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const syLabel = `SY-${tokenSymbol}`;
  const ptLabel = `PT-${tokenSymbol}`;
  const ytLabel = `YT-${tokenSymbol}`;

  // Get input/output token addresses and labels based on direction
  const inputToken = isBuying
    ? market.syAddress
    : tokenType === 'PT'
      ? market.ptAddress
      : market.ytAddress;
  const inputLabel = isBuying ? syLabel : tokenType === 'PT' ? ptLabel : ytLabel;
  const outputLabel = isBuying ? (tokenType === 'PT' ? ptLabel : ytLabel) : syLabel;

  // Fetch balance for input token
  const { data: inputBalance } = useTokenBalance(inputToken);

  // For selling YT, we also need SY balance for collateral
  const { data: syBalance } = useTokenBalance(market.syAddress);

  // Fetch historical price impact data for the market
  const { data: priceImpactData } = usePriceImpact(market.address, { days: 30 });

  // Get market params for AMM calculations
  const marketParams = useMemo(() => getMarketParams(network), [network]);

  // Parse input amount
  const parsedInputAmount = useMemo(() => {
    if (!inputAmount || inputAmount === '') return BigInt(0);
    try {
      return parseWad(inputAmount);
    } catch {
      return BigInt(0);
    }
  }, [inputAmount]);

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

  // Calculate swap quote using accurate AMM math
  const swapResult: SwapResult | null = useMemo(() => {
    if (parsedInputAmount === BigInt(0)) return null;

    const { syReserve, ptReserve } = market.state;
    if (syReserve === BigInt(0) || ptReserve === BigInt(0)) return null;

    try {
      if (direction === 'buy_pt') {
        return calcSwapExactSyForPt(ammState, parsedInputAmount);
      } else if (direction === 'sell_pt') {
        return calcSwapExactPtForSy(ammState, parsedInputAmount);
      } else if (direction === 'buy_yt') {
        const ptSaleResult = calcSwapExactPtForSy(ammState, parsedInputAmount);
        return {
          amountOut: parsedInputAmount,
          fee: ptSaleResult.fee,
          newLnImpliedRate: ptSaleResult.newLnImpliedRate,
          priceImpact: ptSaleResult.priceImpact,
          effectivePrice:
            parsedInputAmount > 0n
              ? ((parsedInputAmount - ptSaleResult.amountOut) * WAD_BIGINT) / parsedInputAmount
              : WAD_BIGINT,
          spotPrice: WAD_BIGINT - ptSaleResult.spotPrice,
        };
      } else {
        const ptNeeded = parsedInputAmount;
        const ptPurchaseResult = calcSwapSyForExactPt(ammState, ptNeeded);
        const syNeededForPt = ptPurchaseResult.amountOut;
        const syOut = ptNeeded > syNeededForPt ? ptNeeded - syNeededForPt : 0n;

        return {
          amountOut: syOut,
          fee: ptPurchaseResult.fee,
          newLnImpliedRate: ptPurchaseResult.newLnImpliedRate,
          priceImpact: ptPurchaseResult.priceImpact,
          effectivePrice: syOut > 0n ? (syNeededForPt * WAD_BIGINT) / syOut : WAD_BIGINT,
          spotPrice: WAD_BIGINT - ptPurchaseResult.spotPrice,
        };
      }
    } catch {
      return null;
    }
  }, [parsedInputAmount, market.state, direction, ammState]);

  // Extract values from swap result
  const expectedOutput = swapResult?.amountOut ?? BigInt(0);
  const priceImpact = swapResult?.priceImpact ?? 0;

  // Price impact warning management
  const priceImpactWarning = usePriceImpactWarning(priceImpact);

  // Calculate implied APY change
  const impliedApyBefore = getImpliedApy(market.state.lnImpliedRate);
  const impliedApyAfter = swapResult
    ? getImpliedApy(swapResult.newLnImpliedRate)
    : impliedApyBefore;

  // Estimate historical average impact for this trade size
  const historicalAvgImpact = useMemo(() => {
    if (!priceImpactData?.impactBySize || parsedInputAmount === BigInt(0)) return null;
    return estimateImpact(parsedInputAmount, priceImpactData.impactBySize);
  }, [priceImpactData?.impactBySize, parsedInputAmount]);

  // Calculate minimum output with slippage
  const minOutput = useMemo(() => {
    return calculateMinOutput(expectedOutput, slippageBps);
  }, [expectedOutput, slippageBps]);

  // Validation
  const hasInsufficientBalance = inputBalance !== undefined && parsedInputAmount > inputBalance;
  const isValidAmount = parsedInputAmount > BigInt(0);

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
    priceImpactWarning.canProceed;

  // Determine transaction status
  const txStatus = useMemo(() => {
    if (isSwapping) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isSwapping, isSuccess, isError]);

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

  // Handle token type change
  const handleTokenTypeChange = (newType: string): void => {
    if (newType === 'PT' || newType === 'YT') {
      setTokenType(newType);
      setInputAmount('');
      resetSwap();
      priceImpactWarning.reset();
    }
  };

  // Handle buy/sell change
  const handleDirectionChange = (value: string): void => {
    if (value === 'buy' || value === 'sell') {
      setIsBuying(value === 'buy');
      setInputAmount('');
      resetSwap();
      priceImpactWarning.reset();
    }
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Directional gradient based on buy/sell */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-all duration-500',
          isBuying
            ? 'from-primary/5 bg-gradient-to-br via-transparent to-transparent'
            : 'from-destructive/5 bg-gradient-to-br via-transparent to-transparent'
        )}
        aria-hidden="true"
      />
      <CardContent className="relative space-y-4 p-5">
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

        {/* Input Token */}
        <TokenInput
          label="You pay"
          tokenAddress={inputToken}
          tokenSymbol={inputLabel}
          value={inputAmount}
          onChange={setInputAmount}
          error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
        />

        {/* Animated swap direction button */}
        <div className="relative flex justify-center">
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
        </div>

        {/* Output Preview */}
        <Card className="bg-muted/50 overflow-hidden">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0 text-sm">You receive</span>
              <span className="text-muted-foreground truncate text-xs">
                Min: {formatWad(minOutput, 4)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums">
                {formatWad(expectedOutput, 6)}
              </span>
              {/* Token badge - consistent with TokenInput */}
              <div
                className={cn(
                  'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
                  'border-border/50 border',
                  isBuying && tokenType === 'PT' && 'bg-primary/10',
                  isBuying && tokenType === 'YT' && 'bg-chart-2/10',
                  !isBuying && 'bg-chart-1/10'
                )}
              >
                <span
                  className={cn(
                    'font-mono text-sm font-semibold',
                    isBuying && tokenType === 'PT' && 'text-primary',
                    isBuying && tokenType === 'YT' && 'text-chart-2',
                    !isBuying && 'text-chart-1'
                  )}
                >
                  {isBuying ? tokenType : 'SY'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Impact Meter */}
        {isValidAmount && <PriceImpactMeter impact={priceImpact} />}

        {/* Collapsible Swap Details */}
        <Collapsible>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm transition-colors">
            <span>Swap Details</span>
            <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span
                className={isValidAmount ? 'text-foreground font-mono' : 'text-muted-foreground'}
              >
                1 {inputLabel} ={' '}
                {parsedInputAmount > BigInt(0)
                  ? new BigNumber(expectedOutput.toString())
                      .dividedBy(parsedInputAmount.toString())
                      .toFixed(4)
                  : '-'}{' '}
                {outputLabel}
              </span>
            </div>

            {/* Implied APY Change */}
            {(direction === 'buy_pt' || direction === 'sell_pt') && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Implied APY</span>
                <span className={isValidAmount ? 'text-foreground' : 'text-muted-foreground'}>
                  {(impliedApyBefore * 100).toFixed(2)}%{' '}
                  <span className="text-muted-foreground">→</span>{' '}
                  <span
                    className={cn(
                      !isValidAmount && 'text-muted-foreground',
                      isValidAmount && impliedApyAfter > impliedApyBefore && 'text-primary',
                      isValidAmount && impliedApyAfter < impliedApyBefore && 'text-destructive'
                    )}
                  >
                    {isValidAmount
                      ? (impliedApyAfter * 100).toFixed(2)
                      : (impliedApyBefore * 100).toFixed(2)}
                    %
                  </span>
                </span>
              </div>
            )}

            {historicalAvgImpact !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Historical Avg Impact</span>
                <span className="text-muted-foreground font-mono">
                  {historicalAvgImpact.toFixed(2)}%
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span className="text-foreground">{slippagePercent}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Swap Fee</span>
              <span
                className={cn(
                  'font-mono',
                  isValidAmount && swapResult !== null && swapResult.fee > 0n
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {isValidAmount && swapResult !== null && swapResult.fee > 0n
                  ? `${formatWad(swapResult.fee, 6)} ${syLabel}`
                  : '-'}
              </span>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Price Impact Warning */}
        {isValidAmount && priceImpactWarning.severity !== 'low' && (
          <PriceImpactWarning
            priceImpact={priceImpact}
            onAcknowledge={priceImpactWarning.acknowledge}
            acknowledged={priceImpactWarning.acknowledged}
          />
        )}

        {/* Transaction Settings */}
        <TransactionSettingsPanel />

        {/* YT Sell Collateral Warning */}
        {direction === 'sell_yt' && isValidAmount && (
          <Card className="border-warning/30 bg-warning/10">
            <CardContent className="flex items-start gap-2 p-3 text-sm">
              <svg
                className="text-warning mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-warning font-medium">Collateral Required</p>
                <p className="text-warning/80 mt-1">
                  Selling YT requires {formatWad(collateralRequired, 4)} {syLabel} as temporary
                  collateral.
                </p>
                {hasInsufficientCollateral && (
                  <p className="text-destructive mt-1">
                    Insufficient {syLabel} balance. You have {formatWad(syBalance, 4)}.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Status */}
        {txStatus !== 'idle' && (
          <TxStatus status={txStatus} txHash={transactionHash ?? null} error={error} />
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSwap}
          disabled={!canSwap || isSwapping}
          className={cn(
            'h-12 w-full text-base font-medium',
            isBuying ? '' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
          )}
        >
          {isSwapping
            ? 'Swapping...'
            : !isConnected
              ? 'Connect Wallet'
              : !isValidAmount
                ? 'Enter Amount'
                : hasInsufficientBalance
                  ? 'Insufficient Balance'
                  : hasInsufficientCollateral
                    ? 'Insufficient Collateral'
                    : priceImpactWarning.requiresAcknowledgment && !priceImpactWarning.acknowledged
                      ? 'Acknowledge Price Impact'
                      : isSuccess
                        ? 'Swapped!'
                        : `${isBuying ? 'Buy' : 'Sell'} ${tokenType}`}
        </Button>
      </CardContent>
    </Card>
  );
}
