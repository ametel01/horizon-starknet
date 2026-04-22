'use client';

import type { ImpliedApyDisplay } from '@features/swap/lib/swapFormLogic';
import type { SwapPreviewResult } from '@features/swap/model/useSwapPreview';
import { calculateFeeSplit } from '@shared/lib/fees';
import { cn } from '@shared/lib/utils';
import type { SwapResult } from '@shared/math/amm';
import { formatWad } from '@shared/math/wad';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/Collapsible';
import { FormRow } from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@shared/ui/hover-card';
import { Skeleton } from '@shared/ui/Skeleton';
import BigNumber from 'bignumber.js';
import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
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

  // Fee split configuration (from market state)
  reserveFeePercent: number;

  // Gas estimate
  formattedFee: string | null;
  formattedFeeUsd: string | null;
  isEstimatingFee: boolean;
  feeError: Error | null;

  // On-chain preview (from RouterStatic) - only available for PT swaps
  previewResult: SwapPreviewResult | null | undefined;
  isPreviewLoading: boolean;
  isPreviewAvailable: boolean;
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
  reserveFeePercent,
  formattedFee,
  formattedFeeUsd,
  isEstimatingFee,
  feeError,
  previewResult,
  isPreviewLoading,
  isPreviewAvailable,
}: SwapDetailsProps): ReactNode {
  // Pre-compute rate display
  const rateDisplay = formatRateDisplay(parsedInputAmount, expectedOutput, inputLabel, outputLabel);

  // Pre-compute swap fee display with breakdown
  const swapFeeDisplay = formatSwapFeeDisplay(
    swapResult,
    isValidAmount,
    syLabel,
    reserveFeePercent
  );

  // Compute on-chain preview display
  const previewDisplay = formatPreviewDisplay(
    previewResult,
    expectedOutput,
    outputLabel,
    isPreviewLoading,
    isPreviewAvailable,
    isValidAmount
  );

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

        {/* On-chain Preview Output - only shown for PT swaps when RouterStatic is available */}
        {previewDisplay.show && (
          <div className="flex items-center justify-between gap-2">
            <HoverCard>
              <HoverCardTrigger className="text-muted-foreground hover:text-foreground inline-flex cursor-help items-center gap-1 text-sm transition-colors">
                Expected (on-chain)
                <Info className="h-3 w-3 opacity-50" />
              </HoverCardTrigger>
              <HoverCardContent side="top" align="start" className="w-64">
                <div className="space-y-2">
                  <h4 className="text-foreground text-sm font-medium">On-chain Preview</h4>
                  <p className="text-muted-foreground text-xs">
                    Live output estimate from RouterStatic contract. This reflects the current
                    on-chain market state and may differ from the calculated estimate.
                  </p>
                </div>
              </HoverCardContent>
            </HoverCard>
            <span className="text-foreground text-sm">
              {previewDisplay.isLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('font-mono', previewDisplay.valueClass)}>
                    {previewDisplay.text}
                  </span>
                  {previewDisplay.showDiscrepancyWarning && (
                    <HoverCard>
                      <HoverCardTrigger className="text-warning cursor-help">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </HoverCardTrigger>
                      <HoverCardContent side="top" align="end" className="w-56">
                        <div className="space-y-2">
                          <h4 className="text-warning text-sm font-medium">Output Discrepancy</h4>
                          <p className="text-muted-foreground text-xs">
                            The on-chain preview differs from the calculated estimate by{' '}
                            <span className="font-mono">{previewDisplay.discrepancyPercent}</span>.
                            This may indicate market state has changed.
                          </p>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </span>
              )}
            </span>
          </div>
        )}

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

        {/* Swap Fee with breakdown hover */}
        <FormRow
          label="Swap Fee"
          labelClassName="text-sm"
          valueClassName={cn(
            'font-mono text-sm',
            !swapFeeDisplay.hasValue && 'text-muted-foreground'
          )}
          value={
            swapFeeDisplay.hasBreakdown ? (
              <HoverCard>
                <HoverCardTrigger className="hover:text-primary inline-flex cursor-help items-center gap-1 font-mono transition-colors">
                  {swapFeeDisplay.text}
                  <Info className="h-3 w-3 opacity-50" />
                </HoverCardTrigger>
                <HoverCardContent side="top" align="end" className="w-56">
                  <div className="space-y-2">
                    <h4 className="text-foreground text-sm font-medium">Fee Breakdown</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LP Share</span>
                        <span className="text-foreground font-mono">
                          {swapFeeDisplay.lpFeeFormatted}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Treasury Share</span>
                        <span className="text-foreground font-mono">
                          {swapFeeDisplay.reserveFeeFormatted}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground border-t pt-2 text-[10px]">
                      LP fees stay in the pool. Treasury fees go to the protocol.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              swapFeeDisplay.text
            )
          }
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
  hasBreakdown: boolean;
  lpFeeFormatted: string;
  reserveFeeFormatted: string;
}

function formatSwapFeeDisplay(
  swapResult: SwapResult | null,
  isValidAmount: boolean,
  syLabel: string,
  reserveFeePercent: number
): SwapFeeDisplayResult {
  if (isValidAmount && swapResult !== null && swapResult.fee > 0n) {
    const { lpFee, reserveFee } = calculateFeeSplit(swapResult.fee, reserveFeePercent);
    const hasBreakdown = reserveFeePercent > 0;

    return {
      text: `${formatWad(swapResult.fee, 6)} ${syLabel}`,
      hasValue: true,
      hasBreakdown,
      lpFeeFormatted: `${formatWad(lpFee, 6)} ${syLabel}`,
      reserveFeeFormatted: `${formatWad(reserveFee, 6)} ${syLabel}`,
    };
  }
  return {
    text: '-',
    hasValue: false,
    hasBreakdown: false,
    lpFeeFormatted: '-',
    reserveFeeFormatted: '-',
  };
}

// Threshold for showing discrepancy warning (1% difference)
const DISCREPANCY_THRESHOLD = 0.01;

interface PreviewDisplayResult {
  show: boolean;
  isLoading: boolean;
  text: string;
  valueClass: string;
  showDiscrepancyWarning: boolean;
  discrepancyPercent: string;
}

/**
 * Formats the on-chain preview display.
 * Shows the preview output and highlights significant discrepancies from calculated output.
 */
function formatPreviewDisplay(
  previewResult: SwapPreviewResult | null | undefined,
  expectedOutput: bigint,
  outputLabel: string,
  isPreviewLoading: boolean,
  isPreviewAvailable: boolean,
  isValidAmount: boolean
): PreviewDisplayResult {
  // Don't show if preview is not available (YT swaps or RouterStatic not deployed)
  if (!isPreviewAvailable) {
    return {
      show: false,
      isLoading: false,
      text: '-',
      valueClass: 'text-muted-foreground',
      showDiscrepancyWarning: false,
      discrepancyPercent: '',
    };
  }

  // Show row with loading state
  if (isPreviewLoading || !isValidAmount) {
    return {
      show: true,
      isLoading: isPreviewLoading && isValidAmount,
      text: '-',
      valueClass: 'text-muted-foreground',
      showDiscrepancyWarning: false,
      discrepancyPercent: '',
    };
  }

  // Preview not available (null result means RouterStatic returned null)
  if (!previewResult) {
    return {
      show: true,
      isLoading: false,
      text: 'Unavailable',
      valueClass: 'text-muted-foreground',
      showDiscrepancyWarning: false,
      discrepancyPercent: '',
    };
  }

  // Calculate discrepancy between calculated and preview output
  const previewOutput = previewResult.expectedOutput;
  const discrepancy = calculateDiscrepancy(expectedOutput, previewOutput);
  const showDiscrepancyWarning = Math.abs(discrepancy) > DISCREPANCY_THRESHOLD;

  // Determine value styling based on discrepancy
  let valueClass = 'text-foreground';
  if (showDiscrepancyWarning) {
    valueClass = discrepancy > 0 ? 'text-destructive' : 'text-success';
  }

  return {
    show: true,
    isLoading: false,
    text: `${formatWad(previewOutput, 6)} ${outputLabel}`,
    valueClass,
    showDiscrepancyWarning,
    discrepancyPercent: `${(Math.abs(discrepancy) * 100).toFixed(2)}%`,
  };
}

/**
 * Calculate the percentage discrepancy between calculated and preview outputs.
 * Returns positive if calculated > preview (user would receive less than expected).
 */
function calculateDiscrepancy(calculated: bigint, preview: bigint): number {
  // No expected output means no comparison needed
  if (calculated === 0n) return 0;

  // Preview returns 0 but we calculated something - this is a 100% discrepancy
  if (preview === 0n) return 1;

  // (calculated - preview) / calculated
  const diff = new BigNumber(calculated.toString())
    .minus(preview.toString())
    .dividedBy(calculated.toString());

  return diff.toNumber();
}
