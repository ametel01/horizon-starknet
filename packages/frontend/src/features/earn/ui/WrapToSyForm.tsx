'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { useWrapToSy } from '@features/earn';
import { TokenInput, TokenOutput } from '@features/mint';
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
import { type Step, StepProgress } from '@shared/ui/StepProgress';
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
    buildWrapCalls,
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

  // Build calls for gas estimation
  const wrapCalls = useMemo(() => {
    if (!amount || amount === '0' || validationError || !underlyingAddress) return null;
    try {
      const amountWad = toWad(amount);
      return buildWrapCalls(amountWad);
    } catch {
      return null;
    }
  }, [amount, validationError, underlyingAddress, buildWrapCalls]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(wrapCalls);

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

  // Transaction steps for StepProgress
  const transactionSteps: Step[] = useMemo(() => {
    return [
      { label: 'Approve', description: 'Approve token spending' },
      { label: 'Deposit', description: 'Deposit tokens to protocol' },
    ];
  }, []);

  // Calculate current step based on transaction state
  const currentStep = useMemo(() => {
    if (status === 'success') return transactionSteps.length; // All complete
    if (status === 'pending' || status === 'signing') return transactionSteps.length - 1; // Show last step as active
    return -1; // No transaction in progress
  }, [status, transactionSteps.length]);

  // Get token symbols from metadata
  const underlyingSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${underlyingSymbol}`;
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader
        title={`Deposit ${underlyingSymbol}`}
        description={`Deposit your ${tokenName} to use in the protocol`}
        action={<ExpiryBadge expiryTimestamp={market.expiry} />}
      />

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You deposit"
          tokenAddress={underlyingAddress ?? ''}
          tokenSymbol={underlyingSymbol}
          value={amount}
          onChange={setAmount}
          disabled={isLoading || !underlyingAddress}
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
        label="Available to mint"
        amount={outputAmount}
        tokenSymbol={sySymbol}
        isLoading={underlyingBalanceLoading}
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
                formattedFeeUsd={formattedFeeUsd}
                isLoading={isEstimatingFee}
                error={feeError}
              />
            }
          />
        )}
      </FormInfoSection>

      {/* Transaction Progress */}
      {status !== 'idle' && (
        <div className="space-y-4">
          <StepProgress steps={transactionSteps} currentStep={currentStep} />
          <TxStatus
            status={status}
            txHash={txHash}
            error={error}
            gasEstimate={{
              formattedFee,
              formattedFeeUsd,
              isLoading: isEstimatingFee,
              error: feeError,
            }}
          />
        </div>
      )}

      {/* Actions */}
      <FormActions>
        {status === 'success' ? (
          <Button onClick={handleReset} variant="form-primary">
            Deposit More
          </Button>
        ) : (
          <Button onClick={handleWrap} disabled={buttonDisabled} variant="form-primary">
            {buttonText}
          </Button>
        )}
      </FormActions>
    </FormLayout>
  );
}
