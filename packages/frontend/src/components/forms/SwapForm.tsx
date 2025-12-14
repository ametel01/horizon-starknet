'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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

  // Get token symbol from metadata
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? '';
  const syLabel = tokenSymbol ? `SY-${tokenSymbol}` : 'SY';
  const ptLabel = tokenSymbol ? `PT-${tokenSymbol}` : 'PT';
  const ytLabel = tokenSymbol ? `YT-${tokenSymbol}` : 'YT';

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

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setInputAmount('');
        resetSwap();
      }, 5000);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [isSuccess, resetSwap]);

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(): void => {
              handleTokenTypeChange('PT');
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tokenType === 'PT'
                ? 'bg-neutral-700 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            PT (Principal)
          </button>
          <button
            type="button"
            onClick={(): void => {
              handleTokenTypeChange('YT');
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tokenType === 'YT'
                ? 'bg-neutral-700 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            YT (Yield)
          </button>
        </div>

        {/* Buy/Sell Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(): void => {
              setIsBuying(true);
              setInputAmount('');
              resetSwap();
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isBuying
                ? 'bg-green-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Buy {tokenType}
          </button>
          <button
            type="button"
            onClick={(): void => {
              setIsBuying(false);
              setInputAmount('');
              resetSwap();
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              !isBuying
                ? 'bg-red-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Sell {tokenType}
          </button>
        </div>

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
          <button
            type="button"
            onClick={toggleDirection}
            className="rounded-full bg-neutral-800 p-2 transition-colors hover:bg-neutral-700"
            aria-label="Toggle swap direction"
          >
            <svg
              className="h-5 w-5 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* Output Preview */}
        <div className="rounded-lg bg-neutral-800/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">To ({outputLabel})</span>
            <span className="text-sm text-neutral-400">
              Min: {formatWad(minOutput, 6)} {outputLabel}
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">
            {formatWad(expectedOutput, 6)} {outputLabel}
          </div>
        </div>

        {/* Price Impact & Rate */}
        {isValidAmount && (
          <div className="space-y-2 rounded-lg bg-neutral-800/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Rate</span>
              <span className="text-neutral-200">
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
              <span className="text-neutral-400">Price Impact</span>
              <span
                className={
                  priceImpact.gt(3)
                    ? 'text-red-500'
                    : priceImpact.gt(1)
                      ? 'text-yellow-500'
                      : 'text-neutral-200'
                }
              >
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Slippage Tolerance</span>
              <span className="text-neutral-200">{slippageBps / 100}%</span>
            </div>
          </div>
        )}

        {/* Slippage Settings */}
        <div>
          <div className="mb-2 text-sm text-neutral-400">Slippage Tolerance</div>
          <div className="flex gap-2">
            {SLIPPAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={(): void => {
                  setSlippageBps(option.value);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  slippageBps === option.value
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* YT Sell Collateral Warning */}
        {direction === 'sell_yt' && isValidAmount && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500"
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
                <p className="font-medium text-yellow-400">Collateral Required</p>
                <p className="mt-1 text-yellow-200/80">
                  Selling YT requires {formatWad(collateralRequired, 4)} {syLabel} as temporary
                  collateral. This will be refunded after the swap.
                </p>
                {hasInsufficientCollateral && (
                  <p className="mt-1 text-red-400">
                    Insufficient {syLabel} balance. You have {formatWad(syBalance, 4)}.
                  </p>
                )}
              </div>
            </div>
          </div>
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
