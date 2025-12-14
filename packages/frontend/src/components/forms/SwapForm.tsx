'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStarknet } from '@/hooks/useStarknet';
import { calculateMinOutput, type SwapDirection, useSwap } from '@/hooks/useSwap';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWad, parseWad } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput } from './TokenInput';

interface SwapFormProps {
  market: MarketData;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

type TokenType = 'PT' | 'YT';

export function SwapForm({ market }: SwapFormProps): ReactNode {
  const { isConnected } = useStarknet();
  const [tokenType, setTokenType] = useState<TokenType>('PT');
  const [isBuying, setIsBuying] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default

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

  // Get token symbol from metadata - hide SY, just show underlying
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const underlyingLabel = tokenSymbol; // Use underlying symbol instead of SY
  const ptLabel = `PT-${tokenSymbol}`;
  const ytLabel = `YT-${tokenSymbol}`;

  // Get input/output token addresses and labels based on direction
  const inputToken = isBuying
    ? market.syAddress
    : tokenType === 'PT'
      ? market.ptAddress
      : market.ytAddress;
  const inputLabel = isBuying ? underlyingLabel : tokenType === 'PT' ? ptLabel : ytLabel;
  const outputLabel = isBuying ? (tokenType === 'PT' ? ptLabel : ytLabel) : underlyingLabel;

  // Fetch balance for input token
  const { data: inputBalance } = useTokenBalance(inputToken);

  // For selling YT, we also need SY balance for collateral
  const { data: syBalance } = useTokenBalance(market.syAddress);

  // Parse input amount
  const parsedInputAmount = useMemo(() => {
    if (!inputAmount || inputAmount === '') return BigInt(0);
    try {
      return parseWad(inputAmount);
    } catch {
      return BigInt(0);
    }
  }, [inputAmount]);

  // Calculate expected output (simplified - using constant product for now)
  // In a real implementation, this would call the market contract to get the quote
  const expectedOutput = useMemo(() => {
    if (parsedInputAmount === BigInt(0)) return BigInt(0);
    // For a proper implementation, we'd need to call the market to get the actual quote
    // For now, we use a simplified calculation based on reserves
    const { syReserve, ptReserve } = market.state;

    if (direction === 'buy_pt') {
      // Selling SY for PT
      // Using constant product approximation: pt_out = (pt_reserve * sy_in) / (sy_reserve + sy_in)
      if (syReserve === BigInt(0)) return BigInt(0);
      return (ptReserve * parsedInputAmount) / (syReserve + parsedInputAmount);
    } else if (direction === 'sell_pt') {
      // Selling PT for SY
      // pt_in for sy_out: sy_out = (sy_reserve * pt_in) / (pt_reserve + pt_in)
      if (ptReserve === BigInt(0)) return BigInt(0);
      return (syReserve * parsedInputAmount) / (ptReserve + parsedInputAmount);
    } else if (direction === 'buy_yt') {
      // Buy YT with SY via flash swap
      // Simplified: YT amount ≈ SY in (since we mint 1:1 then sell PT)
      // The actual output depends on PT market price, but for estimation:
      // yt_out ≈ sy_in * (1 + pt_price), where pt_price < 1
      if (syReserve === BigInt(0) || ptReserve === BigInt(0)) return BigInt(0);
      // PT price in terms of SY ≈ syReserve / ptReserve
      // Since PT < 1 SY, yt_out > sy_in
      const ptPriceScaled = (syReserve * BigInt(1e18)) / ptReserve;
      // yt_out ≈ sy_in / (1 - pt_discount), simplified to sy_in * 1.05 for estimation
      return (parsedInputAmount * (BigInt(1e18) + (BigInt(1e18) - ptPriceScaled))) / BigInt(1e18);
    } else {
      // Sell YT for SY via flash swap
      // Simplified: SY out ≈ YT in * (1 - PT price)
      // YT value = SY value - PT value
      if (syReserve === BigInt(0) || ptReserve === BigInt(0)) return BigInt(0);
      const ptPriceScaled = (syReserve * BigInt(1e18)) / ptReserve;
      // sy_out ≈ yt_in * (1 - pt_price)
      return (parsedInputAmount * (BigInt(1e18) - ptPriceScaled)) / BigInt(1e18);
    }
  }, [parsedInputAmount, market.state, direction]);

  // Calculate minimum output with slippage
  const minOutput = useMemo(() => {
    return calculateMinOutput(expectedOutput, slippageBps);
  }, [expectedOutput, slippageBps]);

  // Calculate price impact
  const priceImpact = useMemo(() => {
    if (parsedInputAmount === BigInt(0) || expectedOutput === BigInt(0)) return new BigNumber(0);

    // Simple price impact calculation
    const inputBn = new BigNumber(parsedInputAmount.toString());
    const outputBn = new BigNumber(expectedOutput.toString());

    // Effective price vs spot price
    // For simplicity, we compare to 1:1 rate
    const effectiveRate = outputBn.dividedBy(inputBn);
    const impact = new BigNumber(1).minus(effectiveRate).abs().multipliedBy(100);

    return impact;
  }, [parsedInputAmount, expectedOutput]);

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
    !isSuccess;

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
  };

  // Handle token type change
  const handleTokenTypeChange = (newType: TokenType): void => {
    setTokenType(newType);
    setInputAmount('');
    resetSwap();
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
              className="data-active:bg-destructive flex-1 data-active:text-white"
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
                    priceImpact.gt(3)
                      ? 'text-destructive'
                      : priceImpact.gt(1)
                        ? 'text-chart-1'
                        : 'text-foreground'
                  }
                >
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage Tolerance</span>
                <span className="text-foreground">{slippageBps / 100}%</span>
              </div>
            </CardContent>
          </Card>
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
                  Selling YT requires {formatWad(collateralRequired, 4)} {underlyingLabel} as
                  temporary collateral. This will be refunded after the swap.
                </p>
                {hasInsufficientCollateral && (
                  <p className="text-destructive mt-1">
                    Insufficient {underlyingLabel} balance. You have {formatWad(syBalance, 4)}.
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
                    : isSuccess
                      ? 'Swapped!'
                      : `Swap ${inputLabel} for ${outputLabel}`}
        </Button>
      </CardContent>
    </Card>
  );
}
