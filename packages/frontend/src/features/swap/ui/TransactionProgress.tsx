'use client';

import { StepProgress } from '@shared/ui/StepProgress';
import { TxStatus } from '@widgets/display/TxStatus';
import type { ReactNode } from 'react';

interface TransactionStep {
  label: string;
  description: string;
}

interface GasEstimateInput {
  formattedFee: string | null;
  formattedFeeUsd: string | null;
  isLoading: boolean;
  error: Error | string | null;
}

interface TransactionProgressProps {
  /** Current transaction status */
  status: 'idle' | 'pending' | 'success' | 'error';
  /** Transaction hash if available */
  transactionHash: string | null;
  /** Error if status is 'error' */
  error: Error | null;
  /** Steps to display in the progress indicator */
  steps: TransactionStep[];
  /** Current step index */
  currentStep: number;
  /** Gas estimate information */
  gasEstimate: GasEstimateInput;
}

// ============================================================================
// Helper Functions (defined before component for proper hoisting)
// ============================================================================

/**
 * Build gas estimate object with correct types for TxStatus.
 * Handles exactOptionalPropertyTypes by only including properties when they have values.
 */
function buildGasEstimateForTxStatus(gasEstimate: GasEstimateInput): {
  formattedFee: string;
  formattedFeeUsd?: string;
  isLoading?: boolean;
  error?: Error | null;
} {
  const result: {
    formattedFee: string;
    formattedFeeUsd?: string;
    isLoading?: boolean;
    error?: Error | null;
  } = {
    formattedFee: gasEstimate.formattedFee ?? '',
  };

  if (gasEstimate.formattedFeeUsd !== null) {
    result.formattedFeeUsd = gasEstimate.formattedFeeUsd ?? undefined;
  }

  if (gasEstimate.isLoading) {
    result.isLoading = gasEstimate.isLoading;
  }

  if (gasEstimate.error instanceof Error) {
    result.error = gasEstimate.error;
  }

  return result;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Transaction progress display with steps and status.
 * Extracted to reduce SwapForm complexity.
 */
export function TransactionProgress({
  status,
  transactionHash,
  error,
  steps,
  currentStep,
  gasEstimate,
}: TransactionProgressProps): ReactNode {
  // Don't render when idle
  if (status === 'idle') return null;

  // Convert gas estimate to TxStatus format
  // Use a helper function to properly handle exactOptionalPropertyTypes
  const txGasEstimate = gasEstimate.formattedFee
    ? buildGasEstimateForTxStatus(gasEstimate)
    : undefined;

  return (
    <div className="space-y-4">
      <StepProgress steps={steps} currentStep={currentStep} />
      <TxStatus
        status={status}
        txHash={transactionHash}
        error={error}
        {...(txGasEstimate ? { gasEstimate: txGasEstimate } : {})}
      />
    </div>
  );
}
