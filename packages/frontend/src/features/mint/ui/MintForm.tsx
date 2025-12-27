'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { useMint, TokenInput, TokenOutput } from '@features/mint';
import { useAccount } from '@features/wallet';
import { cn } from '@shared/lib/utils';
import { toWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { ExpiryBadge } from '@widgets/display/ExpiryCountdown';
import { TxStatus } from '@widgets/display/TxStatus';

interface MintFormProps {
  market: MarketData;
  className?: string;
}

export function MintForm({ market, className }: MintFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amountSy, setAmountSy] = useState('');

  const { syBalance, syBalanceLoading, mint, status, txHash, error, isLoading, reset } = useMint({
    syAddress: market.syAddress,
    ytAddress: market.ytAddress,
  });

  // Calculate output amounts (1:1 ratio for PT and YT)
  const outputAmount = useMemo(() => {
    if (!amountSy || amountSy === '0') {
      return BigInt(0);
    }
    try {
      return toWad(amountSy);
    } catch {
      return BigInt(0);
    }
  }, [amountSy]);

  // Validate input
  const validationError = useMemo(() => {
    if (!amountSy || amountSy === '0') {
      return null;
    }

    try {
      const amountWad = toWad(amountSy);

      if (syBalance !== undefined && amountWad > syBalance) {
        return 'Insufficient balance';
      }
    } catch {
      return 'Invalid amount';
    }

    return null;
  }, [amountSy, syBalance]);

  // Handle mint
  const handleMint = useCallback(async () => {
    if (validationError) return;
    await mint(amountSy);
  }, [amountSy, mint, validationError]);

  // Clear input on success
  useEffect(() => {
    if (status === 'success') {
      setAmountSy('');
    }
  }, [status]);

  // Handle reset after success
  const handleReset = useCallback(() => {
    setAmountSy('');
    reset();
  }, [reset]);

  // Button state
  const buttonDisabled =
    !isConnected || !amountSy || amountSy === '0' || !!validationError || isLoading;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (isLoading) return 'Minting...';
    if (validationError) return validationError;
    if (!amountSy || amountSy === '0') return 'Enter Amount';
    return 'Mint PT + YT';
  }, [isConnected, isLoading, validationError, amountSy]);

  // Get token symbols from metadata
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;
  const ytSymbol = `YT-${tokenSymbol}`;

  return (
    <Card className={cn('relative flex flex-col overflow-hidden', className)}>
      {/* Ambient gradient overlay */}
      <div
        className="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
        aria-hidden="true"
      />

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle>Mint PT + YT</CardTitle>
          <ExpiryBadge expiryTimestamp={market.expiry} />
        </div>
        <p className="text-muted-foreground text-sm">
          Split your deposit into Principal Token and Yield Token
        </p>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col justify-between gap-4">
        {/* Top Section - Inputs */}
        <div className="space-y-4">
          {/* Input */}
          <TokenInput
            label="You use"
            tokenAddress={market.syAddress}
            tokenSymbol={sySymbol}
            value={amountSy}
            onChange={setAmountSy}
            disabled={isLoading}
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

          {/* Outputs */}
          <div className="space-y-2">
            <TokenOutput
              label="You receive"
              amount={outputAmount}
              tokenSymbol={ptSymbol}
              isLoading={syBalanceLoading}
            />
            <TokenOutput label="You receive" amount={outputAmount} tokenSymbol={ytSymbol} />
          </div>
        </div>

        {/* Bottom Section - Info & Actions */}
        <div className="space-y-4">
          {/* Info */}
          <Card size="sm" className="bg-muted">
            <CardContent className="p-3 text-sm">
              <div className="text-muted-foreground flex justify-between">
                <span>Exchange Rate</span>
                <span className="text-foreground">1 : 1 PT + 1 YT</span>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Status */}
          {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

          {/* Actions */}
          {status === 'success' ? (
            <Button onClick={handleReset} className="h-12 w-full text-base font-medium">
              Mint More
            </Button>
          ) : (
            <Button
              onClick={handleMint}
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
