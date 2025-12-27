'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { TokenInput, TokenOutput } from '@features/mint';
import { useUnwrapSy } from '@features/redeem';
import { useAccount } from '@features/wallet';
import { useUnderlyingAddress } from '@features/yield';
import { useEstimateFee } from '@shared/hooks';
import { toWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import {
  FormActions,
  FormDivider,
  FormHeader,
  FormInfoSection,
  FormInputSection,
  FormLayout,
  FormRow,
} from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { ExpiryBadge } from '@widgets/display/ExpiryCountdown';
import { TxStatus } from '@widgets/display/TxStatus';

interface UnwrapSyFormProps {
  market: MarketData;
  className?: string;
}

export function UnwrapSyForm({ market, className }: UnwrapSyFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState('');

  // Fetch underlying address from SY contract
  const { underlyingAddress, isLoading: underlyingLoading } = useUnderlyingAddress(
    market.syAddress
  );

  const {
    syBalance,
    syBalanceLoading,
    unwrap,
    buildUnwrapCalls,
    status,
    txHash,
    error,
    isLoading,
    reset,
  } = useUnwrapSy({
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

  // Build calls for gas estimation
  const unwrapCalls = useMemo(() => {
    if (!amount || amount === '0' || validationError) return null;
    try {
      const amountWad = toWad(amount);
      return buildUnwrapCalls(amountWad);
    } catch {
      return null;
    }
  }, [amount, validationError, buildUnwrapCalls]);

  // Estimate gas fee
  const { formattedFee, isLoading: isEstimatingFee, error: feeError } = useEstimateFee(unwrapCalls);

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
  const sySymbol = `SY-${underlyingSymbol}`;
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader
        title={`Withdraw ${underlyingSymbol}`}
        description={`Withdraw your deposited ${tokenName} from the protocol`}
        action={<ExpiryBadge expiryTimestamp={market.expiry} />}
      />

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You withdraw"
          tokenAddress={market.syAddress}
          tokenSymbol={sySymbol}
          value={amount}
          onChange={setAmount}
          disabled={isLoading}
          error={validationError ?? undefined}
        />
      </FormInputSection>

      {/* Divider */}
      <FormDivider>
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
      </FormDivider>

      {/* Output */}
      <TokenOutput
        label="You receive"
        amount={outputAmount}
        tokenSymbol={underlyingSymbol}
        isLoading={syBalanceLoading}
      />

      {/* Info Section */}
      <FormInfoSection>
        <FormRow label="Exchange Rate" value="1:1" />
        {outputAmount > BigInt(0) && (
          <FormRow
            label="Estimated Gas"
            value={
              <GasEstimate
                formattedFee={formattedFee}
                isLoading={isEstimatingFee}
                error={feeError}
              />
            }
          />
        )}
      </FormInfoSection>

      {/* Transaction Status */}
      {status !== 'idle' && <TxStatus status={status} txHash={txHash} error={error} />}

      {/* Actions */}
      <FormActions>
        {status === 'success' ? (
          <Button onClick={handleReset} className="h-12 w-full text-base font-medium">
            Withdraw More
          </Button>
        ) : (
          <Button
            onClick={handleUnwrap}
            disabled={buttonDisabled}
            className="h-12 w-full text-base font-medium"
          >
            {buttonText}
          </Button>
        )}
      </FormActions>
    </FormLayout>
  );
}
