'use client';

import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { ExpiryBadge } from '@/components/display/ExpiryCountdown';
import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAccount } from '@/hooks/useAccount';
import { useUnderlyingAddress } from '@/hooks/useUnderlying';
import { useUnwrapSy } from '@/hooks/useUnwrapSy';
import { toWad } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput, TokenOutput } from './TokenInput';

interface UnwrapSyFormProps {
  market: MarketData;
}

export function UnwrapSyForm({ market }: UnwrapSyFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');

  // Fetch underlying address from SY contract
  const { underlyingAddress, isLoading: underlyingLoading } = useUnderlyingAddress(
    market.syAddress
  );

  const { syBalance, syBalanceLoading, unwrap, status, txHash, error, isLoading, reset } =
    useUnwrapSy({
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

      if (syBalance !== undefined && amountWad > syBalance) {
        return 'Insufficient SY balance';
      }
    } catch {
      return 'Invalid amount';
    }

    return null;
  }, [amount, syBalance]);

  // Handle unwrap
  const handleUnwrap = useCallback(async () => {
    if (validationError || !underlyingAddress) return;
    await unwrap(amount);
  }, [amount, unwrap, validationError, underlyingAddress]);

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
    if (!underlyingAddress) return 'No Underlying Found';
    if (isLoading) return status === 'signing' ? 'Confirm in Wallet...' : 'Unwrapping...';
    if (validationError) return validationError;
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Unwrap SY';
  }, [
    isConnected,
    underlyingLoading,
    underlyingAddress,
    isLoading,
    status,
    validationError,
    amount,
  ]);

  // Get token symbols from metadata
  const underlyingSymbol = market.metadata?.yieldTokenSymbol ?? 'Underlying';
  const sySymbol = `SY-${market.metadata?.yieldTokenSymbol ?? 'Token'}`;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Unwrap {sySymbol} to {underlyingSymbol}
          </CardTitle>
          <ExpiryBadge expiryTimestamp={market.expiry} />
        </div>
        <p className="text-sm text-neutral-400">
          Unwrap your Standardized Yield (SY) tokens back to{' '}
          {market.metadata?.yieldTokenName ?? 'yield-bearing tokens'}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input */}
        <TokenInput
          label="You redeem"
          tokenAddress={market.syAddress}
          tokenSymbol={sySymbol}
          value={amount}
          onChange={setAmount}
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

        {/* Output */}
        <TokenOutput
          label="You receive"
          amount={outputAmount}
          tokenSymbol={underlyingSymbol}
          isLoading={syBalanceLoading}
        />

        {/* Info */}
        <div className="rounded-lg bg-neutral-800/50 p-3 text-sm">
          <div className="flex justify-between text-neutral-400">
            <span>Exchange Rate</span>
            <span className="text-neutral-200">
              1 {sySymbol} = 1 {underlyingSymbol}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-neutral-400">
            <span>SY Contract</span>
            <span className="font-mono text-xs text-neutral-200">
              {market.syAddress.slice(0, 6)}...{market.syAddress.slice(-4)}
            </span>
          </div>
        </div>

        {/* Transaction Status */}
        {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

        {/* Actions */}
        {status === 'success' ? (
          <Button onClick={handleReset} className="w-full">
            Unwrap More
          </Button>
        ) : (
          <Button onClick={handleUnwrap} disabled={buttonDisabled} className="w-full">
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
