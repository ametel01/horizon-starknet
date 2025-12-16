'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { NumberInput } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAccount } from '@/hooks/useAccount';
import { useSimpleWithdraw } from '@/hooks/useSimpleWithdraw';
import { formatWad, fromWad, toWad } from '@/lib/math/wad';
import { formatExpiry } from '@/lib/math/yield';
import type { MarketData } from '@/types/market';

interface SimpleWithdrawFormProps {
  market: MarketData;
}

/**
 * Simplified withdraw form for simple mode.
 * Combines redeem + unwrap into a single "Withdraw" action.
 * Pre-expiry: Requires equal PT and YT amounts
 * Post-expiry: Only requires PT
 */
export function SimpleWithdrawForm({ market }: SimpleWithdrawFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');

  const underlyingAddress = market.metadata?.underlyingAddress ?? '';

  const {
    ptBalance,
    ytBalance,
    balancesLoading,
    withdraw,
    status,
    txHash,
    error,
    isLoading,
    reset,
  } = useSimpleWithdraw({
    underlyingAddress,
    syAddress: market.syAddress,
    ptAddress: market.ptAddress,
    ytAddress: market.ytAddress,
    isExpired: market.isExpired,
  });

  // Calculate max withdrawable amount
  // Pre-expiry: min(PT, YT) - need equal amounts
  // Post-expiry: PT balance only
  const maxWithdrawable = useMemo(() => {
    if (ptBalance === undefined) return BigInt(0);
    if (market.isExpired) {
      return ptBalance;
    }
    if (ytBalance === undefined) return BigInt(0);
    return ptBalance < ytBalance ? ptBalance : ytBalance;
  }, [ptBalance, ytBalance, market.isExpired]);

  // Convert amount to bigint
  const amountWad = useMemo(() => {
    if (!amount || amount === '0') {
      return BigInt(0);
    }
    try {
      return toWad(amount);
    } catch {
      return BigInt(0);
    }
  }, [amount]);

  // Validate input
  const validationError = useMemo(() => {
    if (!amount || amount === '0') {
      return null;
    }

    if (amountWad > maxWithdrawable) {
      if (!market.isExpired && ptBalance !== undefined && ytBalance !== undefined) {
        if (ptBalance < ytBalance) {
          return 'Exceeds Fixed-Rate Position balance';
        } else {
          return 'Exceeds Variable-Rate Position balance';
        }
      }
      return 'Insufficient balance';
    }

    return null;
  }, [amount, amountWad, maxWithdrawable, market.isExpired, ptBalance, ytBalance]);

  // Handle withdraw
  const handleWithdraw = useCallback(async () => {
    if (validationError || amountWad === BigInt(0)) return;
    await withdraw(amountWad);
  }, [amountWad, withdraw, validationError]);

  // Handle max button
  const handleMax = useCallback(() => {
    if (maxWithdrawable > BigInt(0)) {
      setAmount(fromWad(maxWithdrawable).toString());
    }
  }, [maxWithdrawable]);

  // Clear input on success
  useEffect(() => {
    if (status === 'success') {
      setAmount('');
    }
  }, [status]);

  // Handle reset after success
  const handleReset = useCallback(() => {
    setAmount('');
    reset();
  }, [reset]);

  // Button state
  const buttonDisabled =
    !isConnected ||
    !amount ||
    amount === '0' ||
    !!validationError ||
    isLoading ||
    maxWithdrawable === BigInt(0);

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (isLoading) return 'Processing...';
    if (validationError) return validationError;
    if (maxWithdrawable === BigInt(0)) return 'No Position to Withdraw';
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Withdraw';
  }, [isConnected, isLoading, validationError, maxWithdrawable, amount]);

  // Get display values
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const maturityDate = formatExpiry(market.expiry);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Withdraw</CardTitle>
        <p className="text-muted-foreground text-sm">
          {market.isExpired
            ? 'Redeem your matured position back to tokens'
            : 'Withdraw your position before maturity'}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance Display */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="mb-3">
              <span className="text-muted-foreground text-sm">Your Position</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Fixed-Rate Position</span>
                {balancesLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="text-foreground font-mono">
                    {formatWad(ptBalance ?? BigInt(0), 4)}
                  </span>
                )}
              </div>
              {!market.isExpired && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Variable-Rate Position</span>
                  {balancesLoading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <span className="text-foreground font-mono">
                      {formatWad(ytBalance ?? BigInt(0), 4)}
                    </span>
                  )}
                </div>
              )}
              <div className="border-border border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium">Available to Withdraw</span>
                  {balancesLoading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <span className="text-foreground font-mono font-medium">
                      {formatWad(maxWithdrawable, 4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amount Input */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount to Withdraw</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMax}
                disabled={isLoading || maxWithdrawable === BigInt(0)}
              >
                MAX
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <NumberInput
                value={amount}
                onChange={setAmount}
                placeholder="0.0"
                disabled={isLoading}
                className="border-0 bg-transparent text-2xl focus-visible:ring-0"
              />
              <span className="text-foreground min-w-[60px] text-right font-medium">
                {tokenSymbol}
              </span>
            </div>
            {validationError && <p className="text-destructive mt-2 text-sm">{validationError}</p>}
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="bg-muted rounded-full p-2">
            <svg
              className="text-muted-foreground h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>

        {/* Output Preview */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="mb-2">
              <span className="text-muted-foreground text-sm">You&apos;ll receive (estimated)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-2xl">{formatWad(amountWad, 4)}</span>
              <span className="text-foreground font-medium">{tokenSymbol}</span>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        {!market.isExpired && (
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              Withdrawing before maturity ({maturityDate}) requires equal amounts of both positions.
              After maturity, you can withdraw your Fixed-Rate Position directly.
            </p>
          </div>
        )}

        {market.isExpired && (
          <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
            <p className="text-primary text-sm">
              Your position has matured. You can now withdraw your full Fixed-Rate Position.
            </p>
          </div>
        )}

        {/* Transaction Status */}
        {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

        {/* Actions */}
        {status === 'success' ? (
          <Button onClick={handleReset} className="w-full">
            Withdraw More
          </Button>
        ) : (
          <Button onClick={handleWithdraw} disabled={buttonDisabled} className="w-full">
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
