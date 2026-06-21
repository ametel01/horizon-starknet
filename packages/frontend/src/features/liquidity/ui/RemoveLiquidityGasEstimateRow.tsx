import { FormRow } from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import type { ReactNode } from 'react';

interface GasEstimateRowProps {
  isValidAmount: boolean;
  formattedFee: string | null;
  formattedFeeUsd: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function GasEstimateRow({
  isValidAmount,
  formattedFee,
  formattedFeeUsd,
  isLoading,
  error,
}: GasEstimateRowProps): ReactNode {
  if (!isValidAmount) return null;
  return (
    <FormRow
      label="Estimated Gas"
      value={
        <GasEstimate
          formattedFee={formattedFee ?? ''}
          formattedFeeUsd={formattedFeeUsd ?? undefined}
          isLoading={isLoading}
          error={error}
        />
      }
    />
  );
}
