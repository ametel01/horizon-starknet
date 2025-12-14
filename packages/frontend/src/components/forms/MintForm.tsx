'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { ExpiryBadge } from '@/components/display/ExpiryCountdown';
import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAccount } from '@/hooks/useAccount';
import { useMint } from '@/hooks/useMint';
import { toWad } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput, TokenOutput } from './TokenInput';

interface MintFormProps {
  market: MarketData;
}

export function MintForm({ market }: MintFormProps): ReactNode {
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
  const ptSymbol = `PT-${tokenSymbol}`;
  const ytSymbol = `YT-${tokenSymbol}`;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mint PT + YT</CardTitle>
          <ExpiryBadge expiryTimestamp={market.expiry} />
        </div>
        <p className="text-sm text-neutral-400">
          Split your deposit into Principal Token and Yield Token
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input */}
        <TokenInput
          label="You use"
          tokenAddress={market.syAddress}
          tokenSymbol={tokenSymbol}
          value={amountSy}
          onChange={setAmountSy}
          disabled={isLoading}
          error={validationError ?? undefined}
        />

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="rounded-full border border-neutral-700 bg-neutral-800 p-2">
            <svg
              className="h-4 w-4 text-neutral-400"
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

        {/* Info */}
        <div className="rounded-lg bg-neutral-800/50 p-3 text-sm">
          <div className="flex justify-between text-neutral-400">
            <span>Exchange Rate</span>
            <span className="text-neutral-200">1 : 1 PT + 1 YT</span>
          </div>
        </div>

        {/* Transaction Status */}
        {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

        {/* Actions */}
        {status === 'success' ? (
          <Button onClick={handleReset} className="w-full">
            Mint More
          </Button>
        ) : (
          <Button onClick={handleMint} disabled={buttonDisabled} className="w-full">
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
