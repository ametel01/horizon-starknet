import { type Accessor, createMemo, type JSX, Show } from 'solid-js';

import { calculateFeeSplit } from '@shared/lib/fees';
import { cn } from '@shared/lib/utils';
import type { SwapResult } from '@shared/math/amm';
import { formatWad } from '@shared/math/wad';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/Collapsible';
import { FormRow } from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@shared/ui/HoverCard';

import {
  deriveImpliedApyDisplay,
  formatSwapRate,
  type ImpliedApyDisplay,
} from '../lib/swapFormLogic';
import type { SwapDirection } from '../model/useSwap';

// ============================================================================
// Inline Icons
// ============================================================================

function ChevronDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function InfoIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface SwapDetailsProps {
  /** Input token label (e.g., "SY-xSTRK") */
  inputLabel: Accessor<string>;
  /** Output token label (e.g., "PT-xSTRK") */
  outputLabel: Accessor<string>;
  /** SY token label for fee display */
  syLabel: Accessor<string>;
  /** Parsed input amount in WAD */
  parsedInputAmount: Accessor<bigint>;
  /** Expected output amount in WAD */
  expectedOutput: Accessor<bigint>;
  /** Minimum output after slippage in WAD */
  minOutput: Accessor<bigint>;
  /** Whether the input amount is valid (> 0) */
  isValidAmount: Accessor<boolean>;
  /** Swap direction for implied APY display */
  direction: Accessor<SwapDirection>;
  /** Implied APY before swap */
  impliedApyBefore: Accessor<number>;
  /** Implied APY after swap */
  impliedApyAfter: Accessor<number>;
  /** Price impact as a decimal (e.g., 0.01 = 1%) */
  priceImpact: Accessor<number>;
  /** Historical average impact percentage (optional) */
  historicalAvgImpact?: Accessor<number | null>;
  /** Slippage tolerance in basis points */
  slippageBps: Accessor<number>;
  /** Swap result containing fee info */
  swapResult: Accessor<SwapResult | null>;
  /** Reserve fee percentage (0-100) from market state */
  reserveFeePercent: Accessor<number>;
  /** Formatted gas fee string */
  formattedFee: Accessor<string | null>;
  /** Formatted gas fee in USD */
  formattedFeeUsd?: Accessor<string | null>;
  /** Whether gas estimation is loading */
  isEstimatingFee?: Accessor<boolean>;
  /** Gas estimation error */
  feeError?: Accessor<Error | null>;
}

// ============================================================================
// Helper Types
// ============================================================================

interface SwapFeeDisplayResult {
  text: string;
  hasValue: boolean;
  hasBreakdown: boolean;
  lpFeeFormatted: string;
  reserveFeeFormatted: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SwapDetails - Collapsible swap details section
 *
 * Displays:
 * - Exchange rate
 * - Price impact (with color-coded severity)
 * - Minimum received after slippage
 * - Implied APY change (for PT swaps)
 * - Historical average impact
 * - Slippage tolerance
 * - Swap fee with breakdown on hover
 * - Estimated gas fee
 *
 * Implements Jakob's Law: users expect to see these details
 * like other DeFi applications (Uniswap, Pendle, etc.)
 */
export function SwapDetails(props: SwapDetailsProps): JSX.Element {
  // Pre-compute rate display
  const rateDisplay = createMemo(() =>
    formatSwapRate(
      props.parsedInputAmount(),
      props.expectedOutput(),
      props.inputLabel(),
      props.outputLabel()
    )
  );

  // Pre-compute implied APY display
  const impliedApyDisplay = createMemo<ImpliedApyDisplay>(() =>
    deriveImpliedApyDisplay(
      props.direction(),
      props.impliedApyBefore(),
      props.impliedApyAfter(),
      props.isValidAmount()
    )
  );

  // Pre-compute swap fee display with breakdown
  const swapFeeDisplay = createMemo<SwapFeeDisplayResult>(() => {
    const result = props.swapResult();
    const isValid = props.isValidAmount();
    const syLabel = props.syLabel();
    const reservePercent = props.reserveFeePercent();

    if (isValid && result !== null && result.fee > 0n) {
      const { lpFee, reserveFee } = calculateFeeSplit(result.fee, reservePercent);
      const hasBreakdown = reservePercent > 0;

      return {
        text: `${formatWad(result.fee, 6)} ${syLabel}`,
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
  });

  // Default accessors for optional props
  const historicalAvgImpact = () => props.historicalAvgImpact?.() ?? null;
  const isEstimatingFee = () => props.isEstimatingFee?.() ?? false;
  const feeError = () => props.feeError?.() ?? null;
  const formattedFeeUsd = () => props.formattedFeeUsd?.() ?? null;

  return (
    <Collapsible>
      <CollapsibleTrigger class="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm transition-colors">
        <span>Swap Details</span>
        <ChevronDownIcon class="h-4 w-4 transition-transform [[data-expanded]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent class="space-y-2 pt-3 text-sm">
        {/* Exchange Rate */}
        <FormRow
          label="Rate"
          labelClass="text-sm"
          valueClass={cn('font-mono text-sm', !props.isValidAmount() && 'text-muted-foreground')}
          value={rateDisplay()}
        />

        {/* Price Impact */}
        <FormRow
          label="Price Impact"
          labelClass="text-sm"
          valueClass={cn(
            'font-mono text-sm',
            !props.isValidAmount() && 'text-muted-foreground',
            props.priceImpact() < 0.01 && 'text-muted-foreground',
            props.priceImpact() >= 0.01 && props.priceImpact() < 0.03 && 'text-warning',
            props.priceImpact() >= 0.03 && props.priceImpact() < 0.05 && 'text-orange-500',
            props.priceImpact() >= 0.05 && 'text-destructive'
          )}
          value={props.isValidAmount() ? `${(props.priceImpact() * 100).toFixed(2)}%` : '-'}
        />

        {/* Minimum Received */}
        <FormRow
          label="Minimum Received"
          labelClass="text-sm"
          valueClass={cn('font-mono text-sm', !props.isValidAmount() && 'text-muted-foreground')}
          value={
            props.isValidAmount()
              ? `${formatWad(props.minOutput(), 6)} ${props.outputLabel()}`
              : '-'
          }
        />

        {/* Implied APY Change */}
        <Show when={impliedApyDisplay().showSection}>
          <FormRow
            label="Implied APY"
            labelClass="text-sm"
            valueClass={cn('text-sm', !props.isValidAmount() && 'text-muted-foreground')}
            value={
              <>
                {impliedApyDisplay().beforeFormatted}%{' '}
                <span class="text-muted-foreground">→</span>{' '}
                <span class={impliedApyDisplay().changeClass}>
                  {impliedApyDisplay().afterFormatted}%
                </span>
              </>
            }
          />
        </Show>

        {/* Historical Average Impact */}
        <Show when={historicalAvgImpact() !== null}>
          <FormRow
            label="Historical Avg Impact"
            labelClass="text-sm"
            valueClass="text-muted-foreground font-mono text-sm"
            value={`${historicalAvgImpact()!.toFixed(2)}%`}
          />
        </Show>

        {/* Slippage Tolerance */}
        <FormRow
          label="Slippage Tolerance"
          labelClass="text-sm"
          valueClass="text-sm"
          value={`${(props.slippageBps() / 100).toString()}%`}
        />

        {/* Swap Fee with breakdown hover */}
        <FormRow
          label="Swap Fee"
          labelClass="text-sm"
          valueClass={cn(
            'font-mono text-sm',
            !swapFeeDisplay().hasValue && 'text-muted-foreground'
          )}
          value={
            <Show
              when={swapFeeDisplay().hasBreakdown}
              fallback={<span>{swapFeeDisplay().text}</span>}
            >
              <HoverCard>
                <HoverCardTrigger class="hover:text-primary inline-flex cursor-help items-center gap-1 font-mono transition-colors">
                  {swapFeeDisplay().text}
                  <InfoIcon class="h-3 w-3 opacity-50" />
                </HoverCardTrigger>
                <HoverCardContent class="w-56">
                  <div class="space-y-2">
                    <h4 class="text-foreground text-sm font-medium">Fee Breakdown</h4>
                    <div class="space-y-1 text-xs">
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">LP Share</span>
                        <span class="text-foreground font-mono">
                          {swapFeeDisplay().lpFeeFormatted}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Treasury Share</span>
                        <span class="text-foreground font-mono">
                          {swapFeeDisplay().reserveFeeFormatted}
                        </span>
                      </div>
                    </div>
                    <p class="text-muted-foreground border-t pt-2 text-[10px]">
                      LP fees stay in the pool. Treasury fees go to the protocol.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </Show>
          }
        />

        {/* Estimated Gas Fee */}
        <FormRow
          label="Estimated Gas"
          labelClass="text-sm"
          value={
            <GasEstimate
              formattedFee={props.formattedFee() ?? ''}
              formattedFeeUsd={formattedFeeUsd() ?? undefined}
              isLoading={isEstimatingFee()}
              error={feeError()}
            />
          }
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export type { SwapFeeDisplayResult };
