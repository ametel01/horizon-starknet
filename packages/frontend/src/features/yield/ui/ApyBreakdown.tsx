'use client';

import { cn } from '@shared/lib/utils';
import { formatApyPercent, getApyColorClass } from '@shared/math/apy-breakdown';
import type { ReactNode } from 'react';
import type { MarketApyBreakdown } from '@/types/apy';

import { ApyRow } from './ApyRow';

interface ApyBreakdownProps {
  breakdown: MarketApyBreakdown;
  view: 'pt' | 'yt' | 'lp';
  title?: string;
  className?: string;
}

export function ApyBreakdown({ breakdown, view, className }: ApyBreakdownProps): ReactNode {
  return (
    <div className={cn('space-y-4', className)}>
      {/* PT Fixed APY View */}
      {view === 'pt' && (
        <div className="border-primary/30 bg-primary/10 rounded-lg border p-4">
          <div className="text-primary text-sm">Fixed APY</div>
          <div className="text-primary text-2xl font-bold">
            {formatApyPercent(breakdown.ptFixedApy)}
          </div>
          <div className="text-primary/80 mt-1 text-xs">Guaranteed at maturity</div>
        </div>
      )}

      {/* YT Long Yield APY View */}
      {view === 'yt' && (
        <div className="space-y-3">
          <div className="border-accent/30 bg-accent/10 rounded-lg border p-4">
            <div className="text-foreground text-sm">Long Yield APY</div>
            <div
              className={cn(
                'text-2xl font-bold',
                breakdown.ytApy.longYieldApy >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {formatApyPercent(breakdown.ytApy.longYieldApy)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {breakdown.ytApy.leverage.toFixed(1)}x leverage
            </div>
          </div>

          <div className="space-y-2">
            <ApyRow
              label="Break-even APY"
              value={breakdown.ytApy.breakEvenApy}
              tooltip="Underlying APY needed to break even on YT purchase"
            />
            <ApyRow
              label="Current Underlying APY"
              value={breakdown.underlying.totalApy}
              tooltip="Current yield rate of the underlying asset"
              highlight={breakdown.underlying.totalApy > breakdown.ytApy.breakEvenApy}
            />
          </div>
        </div>
      )}

      {/* LP APY View */}
      {view === 'lp' && (
        <div className="space-y-3">
          <div className="border-secondary bg-secondary rounded-lg border p-4">
            <div className="text-secondary-foreground/80 text-sm">Total LP APY</div>
            <div className="text-secondary-foreground text-2xl font-bold">
              {formatApyPercent(breakdown.lpApy.total)}
            </div>
          </div>

          <div className="text-foreground text-sm font-medium">Breakdown</div>

          <div className="space-y-2">
            <ApyRow
              label="PT Yield"
              value={breakdown.lpApy.ptYield}
              tooltip="Your share of PT fixed yield based on pool composition"
            />
            <ApyRow
              label="Underlying Yield"
              value={breakdown.lpApy.syYield}
              tooltip="Yield from SY portion of your LP position"
            />
            <ApyRow
              label="Swap Fees"
              value={breakdown.lpApy.swapFees}
              tooltip="Your share of trading fees (20% of swap fees go to LPs)"
            />
            {breakdown.lpApy.rewards > 0 && (
              <ApyRow
                label="Rewards"
                value={breakdown.lpApy.rewards}
                tooltip="Protocol incentive rewards"
              />
            )}
          </div>
        </div>
      )}

      {/* Underlying breakdown (always shown) */}
      <div className="border-border border-t pt-3">
        <div className="text-muted-foreground mb-2 text-xs font-medium">Underlying Asset Yield</div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Interest APY</span>
            <span className={getApyColorClass(breakdown.underlying.interestApy)}>
              {formatApyPercent(breakdown.underlying.interestApy)}
            </span>
          </div>
          {breakdown.underlying.rewardsApr > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rewards APR</span>
              <span className="text-foreground">
                {formatApyPercent(breakdown.underlying.rewardsApr)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
