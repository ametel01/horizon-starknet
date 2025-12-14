'use client';

import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { ExpiryBadge } from '@/components/display/ExpiryCountdown';
import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAccount } from '@/hooks/useAccount';
import { useUnderlyingAddress } from '@/hooks/useUnderlying';
import { useWrapToSy } from '@/hooks/useWrapToSy';
import { toWad } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

import { TokenInput, TokenOutput } from './TokenInput';

interface WrapToSyFormProps {
  market: MarketData;
}

export function WrapToSyForm({ market }: WrapToSyFormProps): ReactNode {
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
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Deposit {underlyingSymbol}</CardTitle>
          <ExpiryBadge expiryTimestamp={market.expiry} />
        </div>
        <p className="text-sm text-neutral-400">Deposit your {tokenName} to use in the protocol</p>
      </CardHeader>

      <CardContent className="space-y-4">
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
          label="Available to mint"
          amount={outputAmount}
          tokenSymbol={underlyingSymbol}
          isLoading={underlyingBalanceLoading}
        />

        {/* Info */}
        <div className="rounded-lg bg-neutral-800/50 p-3 text-sm">
          <div className="flex justify-between text-neutral-400">
            <span>Exchange Rate</span>
            <span className="text-neutral-200">1:1</span>
          </div>
        </div>

        {/* Transaction Status */}
        {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

        {/* Actions */}
        {status === 'success' ? (
          <Button onClick={handleReset} className="w-full">
            Deposit More
          </Button>
        ) : (
          <Button onClick={handleWrap} disabled={buttonDisabled} className="w-full">
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
