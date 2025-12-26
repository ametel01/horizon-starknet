'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { calculateMinOutputs, useRemoveLiquidity } from '@/hooks/useLiquidity';
import { useStarknet } from '@/hooks/useStarknet';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import type { MarketData } from '@/types/market';
import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact, parseWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import { TokenInput } from './TokenInput';

interface RemoveLiquidityFormProps {
  market: MarketData;
  className?: string;
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

export function RemoveLiquidityForm({ market, className }: RemoveLiquidityFormProps): ReactNode {
  const { isConnected } = useStarknet();
  const [lpAmount, setLpAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default

  const { removeLiquidity, isRemoving, isSuccess, isError, error, transactionHash } =
    useRemoveLiquidity();

  // Get token symbols from metadata for proper naming (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const lpSymbol = `LP-${tokenSymbol}`;

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
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle>Remove Liquidity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {/* Top Section - Inputs */}
        <div className="space-y-4">
          {/* LP Token Input */}
          <TokenInput
            label={`${lpSymbol} Tokens to Remove`}
            tokenAddress={market.address}
            tokenSymbol={lpSymbol}
            value={lpAmount}
            onChange={setLpAmount}
            error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
          />

          {/* Percentage Buttons */}
          <div className="flex gap-2">
            {PERCENTAGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                onClick={(): void => {
                  handlePercentage(option.value);
                }}
                className="flex-1"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Output Preview */}
          <Card size="sm" className="bg-muted">
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-2 text-sm">You will receive</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={
                      isValidAmount
                        ? 'text-foreground text-lg font-semibold'
                        : 'text-muted-foreground text-lg font-semibold'
                    }
                  >
                    {isValidAmount ? formatWad(expectedSyOut, 6) : '0.000000'} SY
                  </span>
                  <span className="text-muted-foreground text-sm">
                    min: {isValidAmount ? formatWad(minSyOut, 6) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={
                      isValidAmount
                        ? 'text-foreground text-lg font-semibold'
                        : 'text-muted-foreground text-lg font-semibold'
                    }
                  >
                    {isValidAmount ? formatWad(expectedPtOut, 6) : '0.000000'} PT
                  </span>
                  <span className="text-muted-foreground text-sm">
                    min: {isValidAmount ? formatWad(minPtOut, 6) : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section - Info & Submit */}
        <div className="space-y-4">
          {/* Pool Info - Always visible */}
          <Card size="sm" className="bg-muted/30">
            <CardContent className="space-y-2 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pool Share Removed</span>
                <span className={isValidAmount ? 'text-foreground' : 'text-muted-foreground'}>
                  {isValidAmount ? poolShareRemoved.toFixed(4) : '-'}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Pool Reserves</span>
                <span className="text-foreground">
                  {formatWadCompact(market.state.syReserve)} SY /{' '}
                  {formatWadCompact(market.state.ptReserve)} PT
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage Tolerance</span>
                <span className="text-foreground">{slippageBps / 100}%</span>
              </div>
            </CardContent>
          </Card>

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
        </div>
      </CardContent>
    </Card>
  );
}
