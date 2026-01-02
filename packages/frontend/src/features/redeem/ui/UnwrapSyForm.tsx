'use client';

import type { MarketData } from '@entities/market';
import { TokenInput, TokenOutput } from '@features/mint';
import { useUnwrapSy } from '@features/redeem';
import { useTransactionSettings } from '@features/tx-settings';
import { useAccount } from '@features/wallet';
import {
  calculateMinOutputWithSlippage,
  NegativeYieldWarning,
  PausedWarningBanner,
  useSyRedeemPreview,
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
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface UnwrapSyFormProps {
  market: MarketData;
  className?: string;
}

export function UnwrapSyForm({ market, className }: UnwrapSyFormProps): ReactNode {
  const { isConnected } = useAccount();
  const { slippageBps, slippagePercent } = useTransactionSettings();
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

  // Preview redeem output from SY contract
  const { data: redeemPreview, isLoading: previewLoading } = useSyRedeemPreview(
    market.syAddress,
    inputAmountWad > 0n ? inputAmountWad : undefined
  );

  // Calculate output amount (from preview or fallback to 1:1)
  const outputAmount = useMemo(() => {
    if (redeemPreview?.expectedOutput !== undefined && redeemPreview.expectedOutput > 0n) {
      return redeemPreview.expectedOutput;
    }
    // Fallback to 1:1 ratio when preview not available
    return inputAmountWad;
  }, [redeemPreview?.expectedOutput, inputAmountWad]);

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

    if (syBalance !== undefined && inputAmountWad > syBalance) {
      return 'Insufficient balance';
    }

    return null;
  }, [amount, inputAmountWad, syBalance]);

  // Build calls for gas estimation
  const unwrapCalls = useMemo(() => {
    if (inputAmountWad === 0n || validationError) return null;
    return buildUnwrapCalls(inputAmountWad);
  }, [inputAmountWad, validationError, buildUnwrapCalls]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(unwrapCalls);

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

  // Transaction steps for StepProgress
  const transactionSteps: Step[] = useMemo(() => {
    return [{ label: 'Withdraw', description: 'Redeem SY for underlying tokens' }];
  }, []);

  // Calculate current step based on transaction state
  const currentStep = useMemo(() => {
    if (status === 'success') return transactionSteps.length; // Complete
    if (status === 'pending' || status === 'signing') return 0; // Active
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
        title={`Withdraw ${underlyingSymbol}`}
        description={`Withdraw your deposited ${tokenName} from the protocol`}
        action={<ExpiryBadge expiryTimestamp={market.expiry} />}
      />

      {/* Paused Info */}
      <PausedWarningBanner syAddress={market.syAddress} context="withdraw" />

      {/* Negative Yield Warning */}
      <NegativeYieldWarning syAddress={market.syAddress} variant="banner" />

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
        {outputAmount > 0n && (
          <FormRow
            label={`Min Received (${slippagePercent} slippage)`}
            value={
              previewLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : (
                <span className="font-mono">
                  {formatWad(minReceived, 4)} {underlyingSymbol}
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
            Withdraw More
          </Button>
        ) : (
          <Button onClick={handleUnwrap} disabled={buttonDisabled} variant="form-primary">
            {buttonText}
          </Button>
        )}
      </FormActions>
    </FormLayout>
  );
}
