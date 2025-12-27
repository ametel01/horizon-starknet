'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { useWrapToSy } from '@features/earn';
import { TokenInput, TokenOutput } from '@features/mint';
import { useAccount } from '@features/wallet';
import { useUnderlyingAddress } from '@features/yield';
import { cn } from '@shared/lib/utils';
import { toWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { ExpiryBadge } from '@widgets/display/ExpiryCountdown';
import { TxStatus } from '@widgets/display/TxStatus';

interface WrapToSyFormProps {
  market: MarketData;
  className?: string;
}

export function WrapToSyForm({ market, className }: WrapToSyFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');

  // Fetch underlying address from SY contract
  const { underlyingAddress, isLoading: underlyingLoading } = useUnderlyingAddress(
    market.syAddress
  );

  const {
    underlyingBalance,
    underlyingBalanceLoading,
    wrap,
    status,
    txHash,
    error,
    isLoading,
    reset,
  } = useWrapToSy({
    underlyingAddress: underlyingAddress ?? '',
    syAddress: market.syAddress,
  });

  // Calculate output amount (1:1 ratio for SY)
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

  // Handle wrap
  const handleWrap = useCallback(async () => {
    if (validationError || !underlyingAddress) return;
    await wrap(amount);
  }, [amount, wrap, validationError, underlyingAddress]);

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
    !underlyingAddress ||
    underlyingLoading;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (underlyingLoading) return 'Loading...';
    if (!underlyingAddress) return 'Token not found';
    if (isLoading) return 'Depositing...';
    if (validationError) return validationError;
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Deposit';
  }, [isConnected, underlyingLoading, underlyingAddress, isLoading, validationError, amount]);

  // Get token symbols from metadata
  const underlyingSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${underlyingSymbol}`;
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';

  return (
    <Card className={cn('relative flex flex-col overflow-hidden', className)}>
      {/* Ambient gradient overlay */}
      <div
        className="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
        aria-hidden="true"
      />

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle>Deposit {underlyingSymbol}</CardTitle>
          <ExpiryBadge expiryTimestamp={market.expiry} />
        </div>
        <p className="text-muted-foreground text-sm">
          Deposit your {tokenName} to use in the protocol
        </p>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col justify-between gap-4">
        {/* Top Section - Inputs */}
        <div className="space-y-4">
          {/* Input */}
          <TokenInput
            label="You deposit"
            tokenAddress={underlyingAddress ?? ''}
            tokenSymbol={underlyingSymbol}
            value={amount}
            onChange={setAmount}
            disabled={isLoading || !underlyingAddress}
            error={validationError ?? undefined}
          />

          {/* Arrow */}
          <div className="flex justify-center">
            <Button variant="ghost" size="icon" className="rounded-full" disabled>
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
            </Button>
          </div>

          {/* Output */}
          <TokenOutput
            label="Available to mint"
            amount={outputAmount}
            tokenSymbol={sySymbol}
            isLoading={underlyingBalanceLoading}
          />
        </div>

        {/* Bottom Section - Info & Action */}
        <div className="space-y-4">
          {/* Info */}
          <Card size="sm" className="bg-muted">
            <CardContent className="p-3 text-sm">
              <div className="text-muted-foreground flex justify-between">
                <span>Exchange Rate</span>
                <span className="text-foreground">1:1</span>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Status */}
          {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

          {/* Actions */}
          {status === 'success' ? (
            <Button onClick={handleReset} className="h-12 w-full text-base font-medium">
              Deposit More
            </Button>
          ) : (
            <Button
              onClick={handleWrap}
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
