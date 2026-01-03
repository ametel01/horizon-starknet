'use client';

import type { ImpliedApyDisplay } from '@features/swap/lib/swapFormLogic';
import { cn } from '@shared/lib/utils';
import type { SwapResult } from '@shared/math/amm';
import { formatWad } from '@shared/math/wad';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/Collapsible';
import { FormRow } from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import BigNumber from 'bignumber.js';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface SwapDetailsProps {
  // Rate display
  inputLabel: string;
  outputLabel: string;
  syLabel: string;
  parsedInputAmount: bigint;
  expectedOutput: bigint;
  isValidAmount: boolean;

  // Implied APY
  impliedApyDisplay: ImpliedApyDisplay;

  // Historical impact
  historicalAvgImpact: number | null;

  // Slippage
  slippageBps: number;

  // Swap fee
  swapResult: SwapResult | null;

  // Gas estimate
  formattedFee: string | null;
  formattedFeeUsd: string | null;
  isEstimatingFee: boolean;
  feeError: Error | null;
}

/**
 * Collapsible swap details section.
 * Extracted to reduce SwapForm complexity.
 */
export function SwapDetails({
  inputLabel,
  outputLabel,
  syLabel,
  parsedInputAmount,
  expectedOutput,
  isValidAmount,
  impliedApyDisplay,
  historicalAvgImpact,
  slippageBps,
  swapResult,
  formattedFee,
  formattedFeeUsd,
  isEstimatingFee,
  feeError,
}: SwapDetailsProps): ReactNode {
  // Pre-compute rate display
  const rateDisplay = formatRateDisplay(parsedInputAmount, expectedOutput, inputLabel, outputLabel);

  // Pre-compute swap fee display
  const swapFeeDisplay = formatSwapFeeDisplay(swapResult, isValidAmount, syLabel);

  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm transition-colors">
        <span>Swap Details</span>
        <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-3 text-sm">
        {/* Exchange Rate */}
        <FormRow
          label="Rate"
          labelClassName="text-sm"
          valueClassName={cn('font-mono text-sm', !isValidAmount && 'text-muted-foreground')}
          value={rateDisplay}
        />

        {/* Implied APY Change */}
        {impliedApyDisplay.showSection && (
          <FormRow
            label="Implied APY"
            labelClassName="text-sm"
            valueClassName={cn('text-sm', !isValidAmount && 'text-muted-foreground')}
            value={
              <>
                {impliedApyDisplay.beforeFormatted}%{' '}
                <span className="text-muted-foreground">→</span>{' '}
                <span className={impliedApyDisplay.changeClass}>
                  {impliedApyDisplay.afterFormatted}%
                </span>
              </>
            }
          />
        )}

        {/* Historical Average Impact */}
        {historicalAvgImpact !== null && (
          <FormRow
            label="Historical Avg Impact"
            labelClassName="text-sm"
            valueClassName="text-muted-foreground font-mono text-sm"
            value={`${historicalAvgImpact.toFixed(2)}%`}
          />
        )}

        {/* Slippage Tolerance */}
        <FormRow
          label="Slippage Tolerance"
          labelClassName="text-sm"
          valueClassName="text-sm"
          value={`${(slippageBps / 100).toString()}%`}
        />

        {/* Swap Fee */}
        <FormRow
          label="Swap Fee"
          labelClassName="text-sm"
          valueClassName={cn(
            'font-mono text-sm',
            !swapFeeDisplay.hasValue && 'text-muted-foreground'
          )}
          value={swapFeeDisplay.text}
        />

        {/* Estimated Gas Fee */}
        <FormRow
          label="Estimated Gas"
          labelClassName="text-sm"
          value={
            <GasEstimate
              formattedFee={formattedFee ?? ''}
              formattedFeeUsd={formattedFeeUsd ?? undefined}
              isLoading={isEstimatingFee}
              error={feeError}
            />
          }
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRateDisplay(
  parsedInputAmount: bigint,
  expectedOutput: bigint,
  inputLabel: string,
  outputLabel: string
): string {
  if (parsedInputAmount <= 0n) {
    return `1 ${inputLabel} = - ${outputLabel}`;
  }

  const rate = new BigNumber(expectedOutput.toString())
    .dividedBy(parsedInputAmount.toString())
    .toFixed(4);

  return `1 ${inputLabel} = ${rate} ${outputLabel}`;
}

interface SwapFeeDisplayResult {
  text: string;
  hasValue: boolean;
}

function formatSwapFeeDisplay(
  swapResult: SwapResult | null,
  isValidAmount: boolean,
  syLabel: string
): SwapFeeDisplayResult {
  if (isValidAmount && swapResult !== null && swapResult.fee > 0n) {
    return {
      text: `${formatWad(swapResult.fee, 6)} ${syLabel}`,
      hasValue: true,
    };
  }
  return { text: '-', hasValue: false };
}
