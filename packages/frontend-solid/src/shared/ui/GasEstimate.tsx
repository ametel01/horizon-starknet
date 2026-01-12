import { cn } from '@shared/lib/utils';
import { type JSX, Show } from 'solid-js';

import { Skeleton } from './Skeleton';

interface GasEstimateProps {
  /** Formatted fee string (e.g., "~0.0001 STRK") */
  formattedFee: string;
  /** Formatted fee in USD (e.g., "$0.02") */
  formattedFeeUsd?: string | undefined;
  /** Whether the estimate is loading */
  isLoading?: boolean | undefined;
  /** Error if estimation failed */
  error?: Error | null | undefined;
  /** Additional CSS classes */
  class?: string | undefined;
}

/**
 * GasEstimate - Displays estimated transaction fee
 *
 * Implements Jakob's Law: users expect to see gas estimates
 * like other DeFi applications (Uniswap, Aave, etc.)
 *
 * Features:
 * - Compact inline display
 * - Loading skeleton
 * - Graceful error handling (hides on error)
 */
function GasEstimate(props: GasEstimateProps): JSX.Element {
  const isLoading = () => props.isLoading ?? false;

  return (
    <Show when={!props.error && (props.formattedFee || isLoading())}>
      <div class={cn('flex items-center gap-1.5 text-xs', props.class)}>
        <svg
          class="text-muted-foreground h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <Show
          when={!isLoading()}
          fallback={<Skeleton class="h-3 w-16" aria-label="Estimating gas" />}
        >
          <span class="text-muted-foreground">
            {props.formattedFee}
            <Show when={props.formattedFeeUsd}>
              <span class="text-muted-foreground/70"> ({props.formattedFeeUsd})</span>
            </Show>
          </span>
        </Show>
      </div>
    </Show>
  );
}

export { GasEstimate };
export type { GasEstimateProps };
