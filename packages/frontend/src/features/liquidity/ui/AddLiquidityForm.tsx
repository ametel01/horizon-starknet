'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { calculateBalancedAmounts, calculateMinLpOut, useAddLiquidity } from '@features/liquidity';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import { useStarknet } from '@features/wallet';
import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact, parseWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Switch } from '@shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { TxStatus } from '@widgets/display/TxStatus';

interface AddLiquidityFormProps {
  market: MarketData;
  className?: string;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

export function AddLiquidityForm({ market, className }: AddLiquidityFormProps): ReactNode {
  const { isConnected } = useStarknet();
  const [syAmount, setSyAmount] = useState('');
  const [ptAmount, setPtAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default
  const [isBalanced, setIsBalanced] = useState(true);

  const { addLiquidity, isAdding, isSuccess, isError, error, transactionHash } = useAddLiquidity();

  // Get token symbols from metadata for proper naming (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;

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
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle>Add Liquidity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {/* Top Section - Inputs */}
        <div className="space-y-4">
          {/* Balanced Mode Toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={isBalanced} onCheckedChange={setIsBalanced} />
            <span className="text-muted-foreground text-sm">Balanced deposit</span>
          </div>

          {/* SY Input */}
          <TokenInput
            label="SY Amount"
            tokenAddress={market.syAddress}
            tokenSymbol={sySymbol}
            value={syAmount}
            onChange={setSyAmount}
            error={hasInsufficientSyBalance ? 'Insufficient balance' : undefined}
          />

          {/* PT Input */}
          <TokenInput
            label="PT Amount"
            tokenAddress={market.ptAddress}
            tokenSymbol={ptSymbol}
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
                  Min: {isValidAmount ? formatWad(minLpOut, 6) : '-'} LP
                </span>
              </div>
              <div className="text-foreground mt-2 text-2xl font-semibold">
                {isValidAmount ? formatWad(expectedLpOut, 6) : '0.000000'} LP
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
                <span className="text-muted-foreground">Share of Pool</span>
                <span className={isValidAmount ? 'text-foreground' : 'text-muted-foreground'}>
                  {isValidAmount ? poolShare.toFixed(4) : '-'}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pool Reserves</span>
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
        </div>
      </CardContent>
    </Card>
  );
}
