'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { PriceImpactWarning, usePriceImpactWarning } from '@/components/display/PriceImpactWarning';
import { TxStatus } from '@/components/display/TxStatus';
import { TransactionSettingsPanel } from '@/components/settings/TransactionSettingsPanel';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTransactionSettings } from '@/contexts/transaction-settings-context';
import { useStarknet } from '@/hooks/useStarknet';
import { calculateMinOutput, type SwapDirection, useSwap } from '@/hooks/useSwap';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { getMarketParams } from '@/lib/constants/addresses';
import {
  calcSwapExactPtForSy,
  calcSwapExactSyForPt,
  calcSwapSyForExactPt,
  formatPriceImpact,
  getImpliedApy,
  getPriceImpactSeverity,
  type MarketState as AmmMarketState,
  type SwapResult,
} from '@/lib/math/amm';
import { formatWad, parseWad, WAD_BIGINT } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput } from './TokenInput';

interface SwapFormProps {
  market: MarketData;
}

type TokenType = 'PT' | 'YT';

export function SwapForm({ market }: SwapFormProps): ReactNode {
  const { isConnected, network } = useStarknet();
  const { slippageBps, slippagePercent } = useTransactionSettings();
  const [tokenType, setTokenType] = useState<TokenType>('PT');
  const [isBuying, setIsBuying] = useState(true);
  const [inputAmount, setInputAmount] = useState('');

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
  // Swaps are between SY and PT/YT (not underlying)
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
      // Use market-specific initialAnchor from metadata, or current ln rate as fallback
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
        // Buy PT with SY - use accurate AMM calculation
        return calcSwapExactSyForPt(ammState, parsedInputAmount);
      } else if (direction === 'sell_pt') {
        // Sell PT for SY - use accurate AMM calculation
        return calcSwapExactPtForSy(ammState, parsedInputAmount);
      } else if (direction === 'buy_yt') {
        // Buy YT with SY via flash swap
        // Step 1: Mint PT+YT from SY (1:1)
        // Step 2: Sell PT back to market
        // Net result: YT amount ≈ SY_in, cost = SY_in - PT_sale_proceeds
        // For estimation: YT_out ≈ SY_in (since minted 1:1)
        // Use PT price to estimate net cost
        const ptSaleResult = calcSwapExactPtForSy(ammState, parsedInputAmount);
        // YT out = amount minted (same as SY in, since 1:1 mint)
        // Effective cost = SY_in - SY_recovered_from_PT_sale
        return {
          amountOut: parsedInputAmount, // YT received = SY deposited for minting
          fee: ptSaleResult.fee,
          newLnImpliedRate: ptSaleResult.newLnImpliedRate,
          priceImpact: ptSaleResult.priceImpact,
          effectivePrice:
            parsedInputAmount > 0n
              ? ((parsedInputAmount - ptSaleResult.amountOut) * WAD_BIGINT) / parsedInputAmount
              : WAD_BIGINT, // Cost per YT
          spotPrice: WAD_BIGINT - ptSaleResult.spotPrice, // YT price ≈ 1 - PT price
        };
      } else {
        // Sell YT for SY via flash swap
        // Step 1: Buy PT to match YT amount (need parsedInputAmount PT to pair with YT)
        // Step 2: Redeem PT+YT for SY (1:1 redemption gives parsedInputAmount SY)
        // Net result: SY_out = redemption_value - PT_purchase_cost
        const ptNeeded = parsedInputAmount; // Need PT equal to YT amount to redeem

        // Calculate SY cost to buy the required PT using exact output function
        const ptPurchaseResult = calcSwapSyForExactPt(ammState, ptNeeded);
        const syNeededForPt = ptPurchaseResult.amountOut; // SY required to buy PT

        // After redemption, we get ptNeeded SY (1:1), minus what we spent buying PT
        const syOut = ptNeeded > syNeededForPt ? ptNeeded - syNeededForPt : 0n;

        return {
          amountOut: syOut,
          fee: ptPurchaseResult.fee,
          newLnImpliedRate: ptPurchaseResult.newLnImpliedRate,
          priceImpact: ptPurchaseResult.priceImpact,
          effectivePrice: syOut > 0n ? (syNeededForPt * WAD_BIGINT) / syOut : WAD_BIGINT,
          spotPrice: WAD_BIGINT - ptPurchaseResult.spotPrice, // YT price ≈ 1 - PT price
        };
      }
    } catch {
      return null;
    }
  }, [parsedInputAmount, market.state, direction, ammState]);

  // Extract values from swap result
  const expectedOutput = swapResult?.amountOut ?? BigInt(0);
  const priceImpact = swapResult?.priceImpact ?? 0;
  const priceImpactSeverity = getPriceImpactSeverity(priceImpact);

  // Price impact warning management
  const priceImpactWarning = usePriceImpactWarning(priceImpact);

  // Calculate implied APY change
  const impliedApyBefore = getImpliedApy(market.state.lnImpliedRate);
  const impliedApyAfter = swapResult
    ? getImpliedApy(swapResult.newLnImpliedRate)
    : impliedApyBefore;

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

  // Determine transaction status for TxStatus component
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

  // Handle direction change (flip buy/sell)
  const toggleDirection = (): void => {
    setIsBuying((prev) => !prev);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
  };

  // Handle token type change
  const handleTokenTypeChange = (newType: TokenType): void => {
    setTokenType(newType);
    setInputAmount('');
    resetSwap();
    priceImpactWarning.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Type Selector (PT vs YT) */}
        <Tabs
          value={tokenType}
          onValueChange={(value) => {
            handleTokenTypeChange(value as TokenType);
          }}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="PT" className="flex-1">
              PT (Principal)
            </TabsTrigger>
            <TabsTrigger value="YT" className="flex-1">
              YT (Yield)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Buy/Sell Toggle */}
        <Tabs
          value={isBuying ? 'buy' : 'sell'}
          onValueChange={(value) => {
            setIsBuying(value === 'buy');
            setInputAmount('');
            resetSwap();
            priceImpactWarning.reset();
          }}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger
              value="buy"
              className="data-active:bg-primary data-active:text-primary-foreground flex-1"
            >
              Buy {tokenType}
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="data-active:bg-destructive data-active:text-primary-foreground flex-1"
            >
              Sell {tokenType}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Input Token */}
        <TokenInput
          label={`From (${inputLabel})`}
          tokenAddress={inputToken}
          tokenSymbol={inputLabel}
          value={inputAmount}
          onChange={setInputAmount}
          error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
        />

        {/* Swap Direction Indicator */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDirection}
            className="rounded-full"
            aria-label="Toggle swap direction"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </Button>
        </div>

        {/* Output Preview */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">To ({outputLabel})</span>
              <span className="text-muted-foreground text-sm">
                Min: {formatWad(minOutput, 6)} {outputLabel}
              </span>
            </div>
            <div className="text-foreground mt-2 text-2xl font-semibold">
              {formatWad(expectedOutput, 6)} {outputLabel}
            </div>
          </CardContent>
        </Card>

        {/* Price Impact & Rate */}
        {isValidAmount && (
          <Card size="sm" className="bg-muted/30">
            <CardContent className="space-y-2 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span className="text-foreground">
                  1 {inputLabel} ={' '}
                  {parsedInputAmount > BigInt(0)
                    ? new BigNumber(expectedOutput.toString())
                        .dividedBy(parsedInputAmount.toString())
                        .toFixed(6)
                    : '0'}{' '}
                  {outputLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span
                  className={
                    priceImpactSeverity === 'very-high'
                      ? 'text-destructive font-medium'
                      : priceImpactSeverity === 'high'
                        ? 'text-destructive'
                        : priceImpactSeverity === 'medium'
                          ? 'text-chart-1'
                          : 'text-foreground'
                  }
                >
                  {formatPriceImpact(priceImpact)}
                </span>
              </div>
              {/* Implied APY Change */}
              {(direction === 'buy_pt' || direction === 'sell_pt') && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Implied APY</span>
                  <span className="text-foreground">
                    {(impliedApyBefore * 100).toFixed(2)}%{' '}
                    <span className="text-muted-foreground">→</span>{' '}
                    <span
                      className={
                        impliedApyAfter > impliedApyBefore
                          ? 'text-primary'
                          : impliedApyAfter < impliedApyBefore
                            ? 'text-destructive'
                            : ''
                      }
                    >
                      {(impliedApyAfter * 100).toFixed(2)}%
                    </span>
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage Tolerance</span>
                <span className="text-foreground">{slippagePercent}</span>
              </div>
              {/* Fee info */}
              {swapResult && swapResult.fee > 0n && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Swap Fee</span>
                  <span>{formatWad(swapResult.fee, 6)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Price Impact Warning */}
        {isValidAmount && priceImpactWarning.severity !== 'low' && (
          <PriceImpactWarning
            priceImpact={priceImpact}
            onAcknowledge={priceImpactWarning.acknowledge}
            acknowledged={priceImpactWarning.acknowledged}
          />
        )}

        {/* Transaction Settings (Slippage & Deadline) */}
        <TransactionSettingsPanel />

        {/* YT Sell Collateral Warning */}
        {direction === 'sell_yt' && isValidAmount && (
          <Card size="sm" className="border-chart-1/30 bg-chart-1/10">
            <CardContent className="flex items-start gap-2 p-3 text-sm">
              <svg
                className="text-chart-1 mt-0.5 h-4 w-4 shrink-0"
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
                <p className="text-chart-1 font-medium">Collateral Required</p>
                <p className="text-chart-1/80 mt-1">
                  Selling YT requires {formatWad(collateralRequired, 4)} {syLabel} as temporary
                  collateral. This will be refunded after the swap.
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
        <Button onClick={handleSwap} disabled={!canSwap || isSwapping} className="w-full">
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
                        : `Swap ${inputLabel} for ${outputLabel}`}
        </Button>
      </CardContent>
    </Card>
  );
}
