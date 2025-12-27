'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { useSimpleDeposit } from '@features/earn';
import { TokenInput } from '@features/mint';
import { useAccount } from '@features/wallet';
import { cn } from '@shared/lib/utils';
import { formatWad, toWad } from '@shared/math/wad';
import { formatExpiry } from '@shared/math/yield';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { TxStatus } from '@widgets/display/TxStatus';

interface SimpleEarnFormProps {
  market: MarketData;
  className?: string;
}

/**
 * Simplified earning form for simple mode.
 * Combines deposit + split into a single "Deposit & Earn" action.
 * Hides SY/PT/YT terminology and focuses on the user's deposit amount and expected returns.
 */
export function SimpleEarnForm({ market, className }: SimpleEarnFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');

  const underlyingAddress = market.metadata?.underlyingAddress ?? '';

  const { underlyingBalance, deposit, status, txHash, error, isLoading, reset } = useSimpleDeposit({
    underlyingAddress,
    syAddress: market.syAddress,
    ytAddress: market.ytAddress,
  });

  // Calculate output amounts (1:1 ratio for PT and YT from underlying)
  const outputAmount = useMemo(() => {
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

    try {
      const amountWad = toWad(amount);

      if (underlyingBalance !== undefined && amountWad > underlyingBalance) {
        return 'Insufficient balance';
      }
    } catch {
      return 'Invalid amount';
    }

    return null;
  }, [amount, underlyingBalance]);

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    if (validationError || !underlyingAddress) return;
    await deposit(amount);
  }, [amount, deposit, validationError, underlyingAddress]);

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
    !underlyingAddress;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (!underlyingAddress) return 'Token not supported';
    if (isLoading) return 'Processing...';
    if (validationError) return validationError;
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Deposit & Earn';
  }, [isConnected, underlyingAddress, isLoading, validationError, amount]);

  // Get display values
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';
  const fixedApy = market.impliedApy.toNumber() * 100;
  const maturityDate = formatExpiry(market.expiry);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle>Earn Fixed Yield</CardTitle>
        <p className="text-muted-foreground text-sm">
          Deposit your {tokenName} to earn a guaranteed fixed rate
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {/* Top Section - Inputs */}
        <div className="space-y-4">
          {/* Input */}
          <TokenInput
            label="You deposit"
            tokenAddress={underlyingAddress}
            tokenSymbol={tokenSymbol}
            value={amount}
            onChange={setAmount}
            disabled={isLoading || !underlyingAddress}
            error={validationError ?? undefined}
          />

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
                <span className="text-muted-foreground text-sm">You&apos;ll receive</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Fixed-Rate Position</span>
                  <span className="text-foreground font-mono">{formatWad(outputAmount, 4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Variable-Rate Position</span>
                  <span className="text-foreground font-mono">{formatWad(outputAmount, 4)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section - Info & Actions */}
        <div className="space-y-4">
          {/* Yield Info */}
          <Card size="sm" className="border-primary/30 bg-primary/5 border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-primary text-sm font-medium">Fixed Rate</div>
                  <div className="text-primary text-2xl font-bold">{fixedApy.toFixed(2)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-sm">Matures on</div>
                  <div className="text-foreground font-medium">{maturityDate}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Simple Info */}
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              Your deposit will be split into two positions. The Fixed-Rate Position earns the
              guaranteed rate shown above. The Variable-Rate Position earns floating yield until
              maturity.
            </p>
          </div>

          {/* Transaction Status */}
          {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

          {/* Actions */}
          {status === 'success' ? (
            <Button onClick={handleReset} className="h-12 w-full text-base font-medium">
              Deposit More
            </Button>
          ) : (
            <Button
              onClick={handleDeposit}
              disabled={buttonDisabled}
              className="h-12 w-full text-base font-medium"
            >
              {buttonText}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
