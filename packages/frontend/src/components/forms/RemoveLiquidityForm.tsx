'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { calculateMinOutputs, useRemoveLiquidity } from '@/hooks/useLiquidity';
import { useStarknet } from '@/hooks/useStarknet';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWad, parseWad } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput } from './TokenInput';

interface RemoveLiquidityFormProps {
  market: MarketData;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

const PERCENTAGE_OPTIONS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: 'Max', value: 100 },
];

export function RemoveLiquidityForm({ market }: RemoveLiquidityFormProps): ReactNode {
  const { isConnected } = useStarknet();
  const [lpAmount, setLpAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default

  const { removeLiquidity, isRemoving, isSuccess, isError, error, transactionHash } =
    useRemoveLiquidity();

  // Fetch LP balance (market is the LP token)
  const { data: lpBalance } = useTokenBalance(market.address);

  // Parse LP amount
  const parsedLpAmount = useMemo(() => {
    if (!lpAmount || lpAmount === '') return BigInt(0);
    try {
      return parseWad(lpAmount);
    } catch {
      return BigInt(0);
    }
  }, [lpAmount]);

  // Calculate expected outputs
  const { expectedSyOut, expectedPtOut } = useMemo(() => {
    if (parsedLpAmount === BigInt(0) || market.state.totalLpSupply === BigInt(0)) {
      return { expectedSyOut: BigInt(0), expectedPtOut: BigInt(0) };
    }

    const { syReserve, ptReserve, totalLpSupply } = market.state;

    const expectedSy = (parsedLpAmount * syReserve) / totalLpSupply;
    const expectedPt = (parsedLpAmount * ptReserve) / totalLpSupply;

    return { expectedSyOut: expectedSy, expectedPtOut: expectedPt };
  }, [parsedLpAmount, market.state]);

  // Calculate minimum outputs with slippage
  const { minSyOut, minPtOut } = useMemo(() => {
    return calculateMinOutputs(
      parsedLpAmount,
      market.state.syReserve,
      market.state.ptReserve,
      market.state.totalLpSupply,
      slippageBps
    );
  }, [parsedLpAmount, market.state, slippageBps]);

  // Calculate share of pool being removed
  const poolShareRemoved = useMemo(() => {
    if (parsedLpAmount === BigInt(0) || market.state.totalLpSupply === BigInt(0)) {
      return new BigNumber(0);
    }
    return new BigNumber(parsedLpAmount.toString())
      .dividedBy(market.state.totalLpSupply.toString())
      .multipliedBy(100);
  }, [parsedLpAmount, market.state.totalLpSupply]);

  // Validation
  const hasInsufficientBalance = lpBalance !== undefined && parsedLpAmount > lpBalance;
  const isValidAmount = parsedLpAmount > BigInt(0);

  const canRemoveLiquidity =
    isConnected && isValidAmount && !hasInsufficientBalance && !isRemoving && !isSuccess;

  // Determine transaction status
  const txStatus = useMemo(() => {
    if (isRemoving) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isRemoving, isSuccess, isError]);

  // Handle remove liquidity
  const handleRemoveLiquidity = (): void => {
    if (!canRemoveLiquidity) return;

    removeLiquidity({
      marketAddress: market.address,
      lpAmount: parsedLpAmount,
      minSyOut,
      minPtOut,
    });
  };

  // Handle percentage buttons
  const handlePercentage = (percentage: number): void => {
    if (lpBalance !== undefined && lpBalance > BigInt(0)) {
      const amount = (lpBalance * BigInt(percentage)) / BigInt(100);
      setLpAmount(formatWad(amount, 18));
    }
  };

  // Clear input on success
  useEffect(() => {
    if (isSuccess) {
      setLpAmount('');
    }
  }, [isSuccess]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remove Liquidity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* LP Token Input */}
        <TokenInput
          label="LP Tokens to Remove"
          tokenAddress={market.address}
          tokenSymbol="LP"
          value={lpAmount}
          onChange={setLpAmount}
          error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
        />

        {/* Percentage Buttons */}
        <div className="flex gap-2">
          {PERCENTAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(): void => {
                handlePercentage(option.value);
              }}
              className="flex-1 rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Output Preview */}
        <div className="rounded-lg bg-neutral-800/50 p-4">
          <div className="mb-2 text-sm text-neutral-400">You will receive</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-neutral-100">
                {formatWad(expectedSyOut, 6)} SY
              </span>
              <span className="text-sm text-neutral-500">min: {formatWad(minSyOut, 6)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-neutral-100">
                {formatWad(expectedPtOut, 6)} PT
              </span>
              <span className="text-sm text-neutral-500">min: {formatWad(minPtOut, 6)}</span>
            </div>
          </div>
        </div>

        {/* Pool Info */}
        {isValidAmount && (
          <div className="space-y-2 rounded-lg bg-neutral-800/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Pool Share Removed</span>
              <span className="text-neutral-200">{poolShareRemoved.toFixed(4)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Current Pool Reserves</span>
              <span className="text-neutral-200">
                {formatWad(market.state.syReserve, 2)} SY / {formatWad(market.state.ptReserve, 2)}{' '}
                PT
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
        <Button
          onClick={handleRemoveLiquidity}
          disabled={!canRemoveLiquidity || isRemoving}
          className="w-full"
        >
          {isRemoving
            ? 'Removing Liquidity...'
            : !isConnected
              ? 'Connect Wallet'
              : !isValidAmount
                ? 'Enter Amount'
                : hasInsufficientBalance
                  ? 'Insufficient LP Balance'
                  : isSuccess
                    ? 'Liquidity Removed!'
                    : 'Remove Liquidity'}
        </Button>
      </CardContent>
    </Card>
  );
}
