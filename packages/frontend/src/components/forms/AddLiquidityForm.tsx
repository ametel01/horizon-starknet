'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { calculateBalancedAmounts, calculateMinLpOut, useAddLiquidity } from '@/hooks/useLiquidity';
import { useStarknet } from '@/hooks/useStarknet';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWad, parseWad } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput } from './TokenInput';

interface AddLiquidityFormProps {
  market: MarketData;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

export function AddLiquidityForm({ market }: AddLiquidityFormProps): ReactNode {
  const { isConnected } = useStarknet();
  const [syAmount, setSyAmount] = useState('');
  const [ptAmount, setPtAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default
  const [isBalanced, setIsBalanced] = useState(true);

  const { addLiquidity, isAdding, isSuccess, isError, error, transactionHash } = useAddLiquidity();

  // Fetch balances
  const { data: syBalance } = useTokenBalance(market.syAddress);
  const { data: ptBalance } = useTokenBalance(market.ptAddress);

  // Parse amounts
  const parsedSyAmount = useMemo(() => {
    if (!syAmount || syAmount === '') return BigInt(0);
    try {
      return parseWad(syAmount);
    } catch {
      return BigInt(0);
    }
  }, [syAmount]);

  const parsedPtAmount = useMemo(() => {
    if (!ptAmount || ptAmount === '') return BigInt(0);
    try {
      return parseWad(ptAmount);
    } catch {
      return BigInt(0);
    }
  }, [ptAmount]);

  // Calculate balanced amounts when SY changes
  useEffect(() => {
    if (isBalanced && syAmount && market.state.syReserve > BigInt(0)) {
      const { ptAmount: calculatedPt } = calculateBalancedAmounts(
        parsedSyAmount,
        true,
        market.state.syReserve,
        market.state.ptReserve
      );
      setPtAmount(formatWad(calculatedPt, 18));
    }
  }, [syAmount, isBalanced, parsedSyAmount, market.state.syReserve, market.state.ptReserve]);

  // Calculate expected LP output
  const expectedLpOut = useMemo(() => {
    if (parsedSyAmount === BigInt(0) || parsedPtAmount === BigInt(0)) {
      return BigInt(0);
    }

    const { syReserve, ptReserve, totalLpSupply } = market.state;

    if (totalLpSupply === BigInt(0)) {
      // Initial liquidity - use geometric mean approximation
      const minAmount = parsedSyAmount < parsedPtAmount ? parsedSyAmount : parsedPtAmount;
      return minAmount;
    }

    // Calculate LP based on proportional contribution
    const lpFromSy = (parsedSyAmount * totalLpSupply) / syReserve;
    const lpFromPt = (parsedPtAmount * totalLpSupply) / ptReserve;

    return lpFromSy < lpFromPt ? lpFromSy : lpFromPt;
  }, [parsedSyAmount, parsedPtAmount, market.state]);

  // Calculate minimum LP output with slippage
  const minLpOut = useMemo(() => {
    return calculateMinLpOut(
      parsedSyAmount,
      parsedPtAmount,
      market.state.syReserve,
      market.state.ptReserve,
      market.state.totalLpSupply,
      slippageBps
    );
  }, [parsedSyAmount, parsedPtAmount, market.state, slippageBps]);

  // Calculate share of pool
  const poolShare = useMemo(() => {
    if (expectedLpOut === BigInt(0)) return new BigNumber(0);
    const newTotalSupply = market.state.totalLpSupply + expectedLpOut;
    if (newTotalSupply === BigInt(0)) return new BigNumber(100);
    return new BigNumber(expectedLpOut.toString())
      .dividedBy(newTotalSupply.toString())
      .multipliedBy(100);
  }, [expectedLpOut, market.state.totalLpSupply]);

  // Validation
  const hasInsufficientSyBalance = syBalance !== undefined && parsedSyAmount > syBalance;
  const hasInsufficientPtBalance = ptBalance !== undefined && parsedPtAmount > ptBalance;
  const isValidAmount = parsedSyAmount > BigInt(0) && parsedPtAmount > BigInt(0);

  const canAddLiquidity =
    isConnected &&
    isValidAmount &&
    !hasInsufficientSyBalance &&
    !hasInsufficientPtBalance &&
    !isAdding &&
    !isSuccess;

  // Determine transaction status
  const txStatus = useMemo(() => {
    if (isAdding) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isAdding, isSuccess, isError]);

  // Handle add liquidity
  const handleAddLiquidity = (): void => {
    if (!canAddLiquidity) return;

    addLiquidity({
      marketAddress: market.address,
      syAddress: market.syAddress,
      ptAddress: market.ptAddress,
      syAmount: parsedSyAmount,
      ptAmount: parsedPtAmount,
      minLpOut,
    });
  };

  // Clear inputs on success
  useEffect(() => {
    if (isSuccess) {
      setSyAmount('');
      setPtAmount('');
    }
  }, [isSuccess]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Liquidity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balanced Mode Toggle */}
        <div className="flex items-center gap-2">
          <Switch checked={isBalanced} onCheckedChange={setIsBalanced} />
          <span className="text-muted-foreground text-sm">Balanced deposit</span>
        </div>

        {/* SY Input */}
        <TokenInput
          label="SY Amount"
          tokenAddress={market.syAddress}
          tokenSymbol="SY"
          value={syAmount}
          onChange={setSyAmount}
          error={hasInsufficientSyBalance ? 'Insufficient balance' : undefined}
        />

        {/* PT Input */}
        <TokenInput
          label="PT Amount"
          tokenAddress={market.ptAddress}
          tokenSymbol="PT"
          value={ptAmount}
          onChange={(value): void => {
            if (!isBalanced) {
              setPtAmount(value);
            }
          }}
          disabled={isBalanced}
          error={hasInsufficientPtBalance ? 'Insufficient balance' : undefined}
        />

        {/* Output Preview */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Expected LP Tokens</span>
              <span className="text-muted-foreground text-sm">
                Min: {formatWad(minLpOut, 6)} LP
              </span>
            </div>
            <div className="text-foreground mt-2 text-2xl font-semibold">
              {formatWad(expectedLpOut, 6)} LP
            </div>
          </CardContent>
        </Card>

        {/* Pool Info */}
        {isValidAmount && (
          <Card size="sm" className="bg-muted/30">
            <CardContent className="space-y-2 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Share of Pool</span>
                <span className="text-foreground">{poolShare.toFixed(4)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pool Reserves</span>
                <span className="text-foreground">
                  {formatWad(market.state.syReserve, 2)} SY / {formatWad(market.state.ptReserve, 2)}{' '}
                  PT
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

        {/* Transaction Status */}
        {txStatus !== 'idle' && (
          <TxStatus status={txStatus} txHash={transactionHash ?? null} error={error} />
        )}

        {/* Submit Button */}
        <Button
          onClick={handleAddLiquidity}
          disabled={!canAddLiquidity || isAdding}
          className="w-full"
        >
          {isAdding
            ? 'Adding Liquidity...'
            : !isConnected
              ? 'Connect Wallet'
              : !isValidAmount
                ? 'Enter Amounts'
                : hasInsufficientSyBalance
                  ? 'Insufficient SY Balance'
                  : hasInsufficientPtBalance
                    ? 'Insufficient PT Balance'
                    : isSuccess
                      ? 'Liquidity Added!'
                      : 'Add Liquidity'}
        </Button>
      </CardContent>
    </Card>
  );
}
