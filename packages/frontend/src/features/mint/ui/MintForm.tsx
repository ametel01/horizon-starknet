'use client';

import type { MarketData } from '@entities/market';
import { TokenInput, TokenOutput, useMint } from '@features/mint';
import { useAccount } from '@features/wallet';
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
import { NearExpiryWarning } from '@shared/ui/NearExpiryWarning';
import { type Step, StepProgress } from '@shared/ui/StepProgress';
import { ExpiryBadge } from '@widgets/display/ExpiryCountdown';
import { TxStatus } from '@widgets/display/TxStatus';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface MintFormProps {
  market: MarketData;
  className?: string;
}

export function MintForm({ market, className }: MintFormProps): ReactNode {
  const { isConnected } = useAccount();
  const [amountSy, setAmountSy] = useState('');

  const {
    syBalance,
    syBalanceLoading,
    mint,
    status,
    txHash,
    error,
    isLoading,
    reset,
    buildMintCalls,
  } = useMint({
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

  // Build calls for gas estimation (Jakob's Law - users expect to see fees)
  const mintCalls = useMemo(() => {
    if (!amountSy || amountSy === '0' || validationError) return null;
    try {
      const amountWad = toWad(amountSy);
      // Default slippage: 0.5%
      const minPyOut = (amountWad * BigInt(995)) / BigInt(1000);
      return buildMintCalls(amountWad, minPyOut);
    } catch {
      return null;
    }
  }, [amountSy, validationError, buildMintCalls]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(mintCalls);

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

  // Button state (Gap 4: Pre-flight validation for expired markets)
  const buttonDisabled =
    !isConnected ||
    !amountSy ||
    amountSy === '0' ||
    !!validationError ||
    isLoading ||
    market.isExpired;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (market.isExpired) return 'Market Expired'; // Gap 4: Pre-flight validation
    if (isLoading) return 'Minting...';
    if (validationError) return validationError;
    if (!amountSy || amountSy === '0') return 'Enter Amount';
    return 'Mint PT + YT';
  }, [isConnected, market.isExpired, isLoading, validationError, amountSy]);

  // Transaction steps for StepProgress
  const transactionSteps: Step[] = useMemo(() => {
    return [
      { label: 'Approve SY', description: 'Approve token spending' },
      { label: 'Mint', description: 'Mint PT + YT tokens' },
    ];
  }, []);

  // Calculate current step based on transaction state
  const currentStep = useMemo(() => {
    if (status === 'success') return transactionSteps.length; // All complete
    if (status === 'pending' || status === 'signing') return transactionSteps.length - 1; // Show last step as active
    return -1; // No transaction in progress
  }, [status, transactionSteps.length]);

  // Get token symbols from metadata
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;
  const ytSymbol = `YT-${tokenSymbol}`;

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader
        title="Mint PT + YT"
        description="Split your deposit into Principal Token and Yield Token"
        action={<ExpiryBadge expiryTimestamp={market.expiry} />}
      />

      {/* Near-expiry warning banner */}
      <NearExpiryWarning expiryTimestamp={market.expiry} context="mint" />

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You use"
          tokenAddress={market.syAddress}
          tokenSymbol={sySymbol}
          value={amountSy}
          onChange={setAmountSy}
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

      {/* Info Section */}
      <FormInfoSection>
        <FormRow label="Exchange Rate" value="1 : 1 PT + 1 YT" />
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
            Mint More
          </Button>
        ) : (
          <Button onClick={handleMint} disabled={buttonDisabled} variant="form-primary">
            {buttonText}
          </Button>
        )}
      </FormActions>
    </FormLayout>
  );
}
