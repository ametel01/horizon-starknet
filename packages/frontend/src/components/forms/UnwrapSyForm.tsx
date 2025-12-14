'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

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
        return 'Insufficient balance';
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
    if (isLoading) return 'Withdrawing...';
    if (validationError) return validationError;
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Withdraw';
  }, [isConnected, underlyingLoading, underlyingAddress, isLoading, validationError, amount]);

  // Get token symbols from metadata
  const underlyingSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Withdraw {underlyingSymbol}</CardTitle>
          <ExpiryBadge expiryTimestamp={market.expiry} />
        </div>
        <p className="text-muted-foreground text-sm">
          Withdraw your deposited {tokenName} from the protocol
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input */}
        <TokenInput
          label="You withdraw"
          tokenAddress={market.syAddress}
          tokenSymbol={underlyingSymbol}
          value={amount}
          onChange={setAmount}
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

        {/* Output */}
        <TokenOutput
          label="You receive"
          amount={outputAmount}
          tokenSymbol={underlyingSymbol}
          isLoading={syBalanceLoading}
        />

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
          <Button onClick={handleReset} className="w-full">
            Withdraw More
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
