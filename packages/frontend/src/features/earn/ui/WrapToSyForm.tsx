'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { useWrapToSy } from '@features/earn';
import { TokenInput, TokenOutput } from '@features/mint';
import { useTransactionSettings } from '@features/tx-settings';
import { useAccount } from '@features/wallet';
import {
  calculateMinOutputWithSlippage,
  NegativeYieldWarning,
  PausedWarningBanner,
  useIsSyPaused,
  useSyDepositPreview,
  useUnderlyingAddress,
} from '@features/yield';
import { useEstimateFee } from '@shared/hooks';
import { formatWad, toWad } from '@shared/math/wad';
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
  const { slippageBps, slippagePercent } = useTransactionSettings();
  const [amount, setAmount] = useState('');

  // Check if SY contract is paused
  const isPaused = useIsSyPaused(market.syAddress);

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

  // Parse input amount to WAD
  const inputAmountWad = useMemo(() => {
    if (!amount || amount === '0') {
      return 0n;
    }
    try {
      return toWad(amount);
    } catch {
      return 0n;
    }
  }, [amount]);

  // Preview deposit output from SY contract
  const { data: depositPreview, isLoading: previewLoading } = useSyDepositPreview(
    market.syAddress,
    inputAmountWad > 0n ? inputAmountWad : undefined
  );

  // Calculate output amount (from preview or fallback to 1:1)
  const outputAmount = useMemo(() => {
    if (depositPreview?.expectedOutput !== undefined && depositPreview.expectedOutput > 0n) {
      return depositPreview.expectedOutput;
    }
    // Fallback to 1:1 ratio when preview not available
    return inputAmountWad;
  }, [depositPreview?.expectedOutput, inputAmountWad]);

  // Calculate minimum received with slippage protection
  const minReceived = useMemo(() => {
    return calculateMinOutputWithSlippage(outputAmount, slippageBps);
  }, [outputAmount, slippageBps]);

  // Validate input
  const validationError = useMemo(() => {
    if (!amount || amount === '0') {
      return null;
    }

    if (inputAmountWad === 0n) {
      return 'Invalid amount';
    }

    if (underlyingBalance !== undefined && inputAmountWad > underlyingBalance) {
      return 'Insufficient balance';
    }

    return null;
  }, [amount, inputAmountWad, underlyingBalance]);

  // Build calls for gas estimation
  const wrapCalls = useMemo(() => {
    if (inputAmountWad === 0n || validationError || !underlyingAddress) return null;
    return buildWrapCalls(inputAmountWad);
  }, [inputAmountWad, validationError, underlyingAddress, buildWrapCalls]);

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
    underlyingLoading ||
    isPaused;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (underlyingLoading) return 'Loading...';
    if (!underlyingAddress) return 'Token not found';
    if (isPaused) return 'Deposits Paused';
    if (isLoading) return 'Depositing...';
    if (validationError) return validationError;
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Deposit';
  }, [
    isConnected,
    underlyingLoading,
    underlyingAddress,
    isPaused,
    isLoading,
    validationError,
    amount,
  ]);

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

      {/* Paused Warning */}
      <PausedWarningBanner syAddress={market.syAddress} context="deposit" />

      {/* Negative Yield Warning */}
      <NegativeYieldWarning syAddress={market.syAddress} variant="banner" />

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
        {outputAmount > 0n && (
          <FormRow
            label={`Min Received (${slippagePercent} slippage)`}
            value={
              previewLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : (
                <span className="font-mono">
                  {formatWad(minReceived, 4)} {sySymbol}
                </span>
              )
            }
          />
        )}
        {outputAmount > 0n && (
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
