import { type Step, StepProgress } from '@shared/ui/StepProgress';
import { TxStatus } from '@widgets/display/TxStatus';
import type { ReactNode } from 'react';

type TxStatusValue = 'idle' | 'pending' | 'success' | 'error';

interface TransactionProgressProps {
  txStatus: TxStatusValue;
  steps: Step[];
  currentStep: number;
  txHash: string | null;
  error: Error | null;
  gasEstimate: {
    formattedFee: string | null;
    formattedFeeUsd: string | null;
    isLoading: boolean;
    error: Error | null;
  };
}

export function TransactionProgress({
  txStatus,
  steps,
  currentStep,
  txHash,
  error,
  gasEstimate,
}: TransactionProgressProps): ReactNode {
  if (txStatus === 'idle') return null;

  const normalizedGasEstimate: {
    formattedFee: string;
    formattedFeeUsd?: string;
    isLoading: boolean;
    error: Error | null;
  } = {
    formattedFee: gasEstimate.formattedFee ?? '',
    isLoading: gasEstimate.isLoading,
    error: gasEstimate.error,
  };
  if (gasEstimate.formattedFeeUsd !== null) {
    normalizedGasEstimate.formattedFeeUsd = gasEstimate.formattedFeeUsd;
  }

  return (
    <div className="space-y-4">
      <StepProgress steps={steps} currentStep={currentStep} />
      <TxStatus
        status={txStatus}
        txHash={txHash}
        error={error}
        gasEstimate={normalizedGasEstimate}
      />
    </div>
  );
}
