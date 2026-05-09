'use client';

import type { MarketData } from '@entities/market';
import { formatFeeRate, getLpFeePercent } from '@shared/lib/fees';
import { cn } from '@shared/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@shared/ui/hover-card';
import { Info } from 'lucide-react';
import { memo, type ReactNode, useMemo } from 'react';

interface FeeStructureProps {
  market: MarketData;
  /** Show compact version (single line) */
  compact?: boolean;
  className?: string;
}

/**
 * FeeStructure - Displays market fee structure with visual split bar.
 *
 * Shows:
 * - Annual fee rate (derived from ln_fee_rate_root via exp(x) - 1)
 * - Fee split visualization between LP and Treasury
 *
 * The fee model uses time-decay: fees scale linearly with time to expiry.
 * reserve_fee_percent determines how much of each fee goes to the protocol treasury.
 *
 * @example
 * ```tsx
 * <FeeStructure market={market} />
 * <FeeStructure market={market} compact />
 * ```
 */
export const FeeStructure = memo(function FeeStructure({
  market,
  compact = false,
  className,
}: FeeStructureProps): ReactNode {
  const { lnFeeRateRoot, reserveFeePercent } = market.state;
  const lpPercent = getLpFeePercent(reserveFeePercent);

  // Format annual fee rate as percentage
  const annualRateFormatted = useMemo(() => formatFeeRate(lnFeeRateRoot, 2), [lnFeeRateRoot]);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <span className="text-muted-foreground">Fee:</span>
        <HoverCard>
          <HoverCardTrigger className="text-foreground hover:text-primary inline-flex cursor-help items-center gap-1 transition-colors">
            <span className="font-mono">{annualRateFormatted}</span>
            <Info className="size-3 opacity-50" />
          </HoverCardTrigger>
          <HoverCardContent side="top" className="w-72">
            <FeeBreakdownContent
              lpPercent={lpPercent}
              reserveFeePercent={reserveFeePercent}
              annualRateFormatted={annualRateFormatted}
            />
          </HoverCardContent>
        </HoverCard>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Fee rate display */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Swap Fee</span>
        <span className="text-foreground font-mono text-sm">{annualRateFormatted}</span>
      </div>

      {/* Fee split visualization */}
      <FeeSplitBar lpPercent={lpPercent} reserveFeePercent={reserveFeePercent} />

      {/* Legend */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="bg-chart-1 size-2 rounded-full" />
          <span className="text-muted-foreground">LP: {lpPercent}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-chart-3 size-2 rounded-full" />
          <span className="text-muted-foreground">Treasury: {reserveFeePercent}%</span>
        </div>
      </div>
    </div>
  );
});

/**
 * Visual bar showing fee split between LP and Treasury
 */
interface FeeSplitBarProps {
  lpPercent: number;
  reserveFeePercent: number;
  className?: string;
}

export const FeeSplitBar = memo(function FeeSplitBar({
  lpPercent,
  reserveFeePercent,
  className,
}: FeeSplitBarProps): ReactNode {
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full', className)}>
      {/* LP portion - left side */}
      <div
        className="bg-chart-1 transition-all duration-300"
        style={{ width: `${String(lpPercent)}%` }}
        title={`LP: ${String(lpPercent)}%`}
      />
      {/* Treasury portion - right side */}
      <div
        className="bg-chart-3 transition-all duration-300"
        style={{ width: `${String(reserveFeePercent)}%` }}
        title={`Treasury: ${String(reserveFeePercent)}%`}
      />
    </div>
  );
});

/**
 * Fee breakdown content for hover card
 */
interface FeeBreakdownContentProps {
  lpPercent: number;
  reserveFeePercent: number;
  annualRateFormatted: string;
}

function FeeBreakdownContent({
  lpPercent,
  reserveFeePercent,
  annualRateFormatted,
}: FeeBreakdownContentProps): ReactNode {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-foreground text-sm font-medium">Fee Structure</h4>
        <p className="text-muted-foreground text-xs">
          Fees are charged on each swap and split between liquidity providers and the protocol
          treasury.
        </p>
      </div>

      {/* Annual rate */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Annual Fee Rate</span>
        <span className="text-foreground font-mono">{annualRateFormatted}</span>
      </div>

      {/* Split bar */}
      <FeeSplitBar lpPercent={lpPercent} reserveFeePercent={reserveFeePercent} />

      {/* Split details */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted rounded-md p-2">
          <div className="text-muted-foreground">LP Share</div>
          <div className="text-foreground font-medium">{lpPercent}%</div>
          <div className="text-muted-foreground mt-0.5">Retained by pool</div>
        </div>
        <div className="bg-muted rounded-md p-2">
          <div className="text-muted-foreground">Treasury Share</div>
          <div className="text-foreground font-medium">{reserveFeePercent}%</div>
          <div className="text-muted-foreground mt-0.5">Protocol revenue</div>
        </div>
      </div>

      {/* Time-decay note */}
      <p className="text-muted-foreground border-t pt-2 text-[10px]">
        Actual fees scale with time to expiry (time-decay model).
      </p>
    </div>
  );
}
