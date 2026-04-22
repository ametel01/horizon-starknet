'use client';

import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math/wad';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@shared/ui/hover-card';
import { Skeleton } from '@shared/ui/Skeleton';
import { Info } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import type { MarketExchangeRates } from '../model/useMarketExchangeRates';

interface MarketRatesProps {
  /** Exchange rates from useMarketExchangeRates hook */
  rates: MarketExchangeRates | null | undefined;
  /** Loading state - shows skeleton when true */
  isLoading?: boolean;
  /** Whether the RouterStatic contract is available */
  isAvailable?: boolean;
  /** Show compact version (single row) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Rate item component for individual rate display
 */
interface RateItemProps {
  label: string;
  rate: bigint | null;
  description: string;
  isLoading?: boolean;
  className?: string;
}

const RateItem = memo(function RateItem({
  label,
  rate,
  description,
  isLoading = false,
  className,
}: RateItemProps): ReactNode {
  const formattedRate = rate ? formatWad(rate, 4) : '-';

  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <HoverCard>
        <HoverCardTrigger className="text-muted-foreground hover:text-foreground inline-flex cursor-help items-center gap-1 text-xs transition-colors">
          <span>{label}</span>
          <Info className="h-3 w-3 opacity-50" />
        </HoverCardTrigger>
        <HoverCardContent side="top" align="start" className="w-56">
          <div className="space-y-1">
            <h4 className="text-foreground text-sm font-medium">{label}</h4>
            <p className="text-muted-foreground text-xs">{description}</p>
          </div>
        </HoverCardContent>
      </HoverCard>
      {isLoading ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <span className="text-foreground font-mono text-xs tabular-nums">{formattedRate}</span>
      )}
    </div>
  );
});

/**
 * MarketRates - Display live exchange rates from RouterStatic.
 *
 * Shows PT/SY, LP/SY, and LP/PT exchange rates in a compact grid.
 * Rates are fetched using useMarketExchangeRates hook and update
 * on a configurable interval (default 30s).
 *
 * Features:
 * - Graceful loading states with skeletons
 * - Hover tooltips explaining each rate
 * - Compact mode for inline display
 * - Handles RouterStatic unavailable fallback
 *
 * @example
 * ```tsx
 * const { data: rates, isLoading } = useMarketExchangeRates(marketAddress);
 * <MarketRates rates={rates} isLoading={isLoading} />
 * ```
 */
export const MarketRates = memo(function MarketRates({
  rates,
  isLoading = false,
  isAvailable = true,
  compact = false,
  className,
}: MarketRatesProps): ReactNode {
  // If RouterStatic is not available, don't render anything
  if (!isAvailable) {
    return null;
  }

  // Show skeleton on initial load only (not on refetch to prevent flicker)
  const showSkeleton = isLoading && !rates;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 text-xs', className)}>
        <RateItem
          label="PT/SY"
          rate={rates?.ptToSyRate ?? null}
          description="How much SY you receive per PT. A rate of 1.05 means 1 PT = 1.05 SY."
          isLoading={showSkeleton}
        />
        <RateItem
          label="LP/SY"
          rate={rates?.lpToSyRate ?? null}
          description="LP token value in SY terms. Increases as the pool earns fees."
          isLoading={showSkeleton}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase">
        Exchange Rates
      </div>
      <div className="grid gap-1.5">
        <RateItem
          label="PT/SY Rate"
          rate={rates?.ptToSyRate ?? null}
          description="How much SY you receive per PT. A rate above 1.0 means PT trades at a premium to SY."
          isLoading={showSkeleton}
        />
        <RateItem
          label="LP/SY Rate"
          rate={rates?.lpToSyRate ?? null}
          description="LP token value in SY terms. This rate increases as the pool earns fees from swaps."
          isLoading={showSkeleton}
        />
        <RateItem
          label="LP/PT Rate"
          rate={rates?.lpToPtRate ?? null}
          description="LP token value in PT terms. Useful for understanding LP exposure to PT price movements."
          isLoading={showSkeleton}
        />
      </div>
    </div>
  );
});
