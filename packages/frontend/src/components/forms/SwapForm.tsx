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

export function SwapForm({ market }: SwapFormProps): ReactNode {
  const { isConnected } = useStarknet();
  const [direction, setDirection] = useState<SwapDirection>('buy_pt');
  const [inputAmount, setInputAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default

  const {
    swap,
    isSwapping,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetSwap,
  } = useSwap();

  // Get input/output token addresses based on direction
  const inputToken = direction === 'buy_pt' ? market.syAddress : market.ptAddress;
  const inputLabel = direction === 'buy_pt' ? 'SY' : 'PT';
  const outputLabel = direction === 'buy_pt' ? 'PT' : 'SY';

  // Fetch balance for input token
  const { data: inputBalance } = useTokenBalance(inputToken);

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
    } else {
      // Selling PT for SY
      // pt_in for sy_out: sy_out = (sy_reserve * pt_in) / (pt_reserve + pt_in)
      if (ptReserve === BigInt(0)) return BigInt(0);
      return (syReserve * parsedInputAmount) / (ptReserve + parsedInputAmount);
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

  const canSwap =
    isConnected && isValidAmount && !hasInsufficientBalance && !isSwapping && !isSuccess;

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

  // Handle direction change
  const toggleDirection = (): void => {
    setDirection((prev) => (prev === 'buy_pt' ? 'sell_pt' : 'buy_pt'));
    setInputAmount('');
    resetSwap();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Direction Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(): void => {
              setDirection('buy_pt');
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              direction === 'buy_pt'
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Buy PT
          </button>
          <button
            type="button"
            onClick={(): void => {
              setDirection('sell_pt');
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              direction === 'sell_pt'
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Sell PT
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
                  : isSuccess
                    ? 'Swapped!'
                    : `Swap ${inputLabel} for ${outputLabel}`}
        </Button>
      </CardContent>
    </Card>
  );
}
