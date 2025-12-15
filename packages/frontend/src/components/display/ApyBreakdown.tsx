'use client';

import { type ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/Card';
import { formatApyPercent, getApyColorClass } from '@/lib/math/apy-breakdown';
import { cn } from '@/lib/utils';
import type { MarketApyBreakdown } from '@/types/apy';

interface ApyBreakdownProps {
  breakdown: MarketApyBreakdown;
  view: 'pt' | 'yt' | 'lp';
  className?: string;
}

interface TooltipProps {
  content: string;
  children: ReactNode;
}

function Tooltip({ content, children }: TooltipProps): ReactNode {
  return (
    <span className="group relative cursor-help">
      {children}
      <span className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {content}
      </span>
    </span>
  );
}

function InfoIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg className={cn('h-3 w-3', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
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
            <div className="text-accent-foreground/80 text-sm">Long Yield APY</div>
            <div
              className={cn(
                'text-2xl font-bold',
                breakdown.ytApy.longYieldApy >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {formatApyPercent(breakdown.ytApy.longYieldApy)}
            </div>
            <div className="text-accent-foreground/60 mt-1 text-xs">
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

interface ApyRowProps {
  label: string;
  value: number;
  tooltip: string;
  highlight?: boolean;
}

function ApyRow({ label, value, tooltip, highlight }: ApyRowProps): ReactNode {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1 text-sm">
        {label}
        <Tooltip content={tooltip}>
          <InfoIcon />
        </Tooltip>
      </span>
      <span
        className={cn('text-sm font-medium', highlight ? 'text-primary' : getApyColorClass(value))}
      >
        {formatApyPercent(value)}
      </span>
    </div>
  );
}

/**
 * Compact APY display for cards and lists
 */
interface ApyCompactProps {
  breakdown: MarketApyBreakdown;
  view: 'pt' | 'yt' | 'lp';
  className?: string;
}

export function ApyCompact({ breakdown, view, className }: ApyCompactProps): ReactNode {
  const getApy = (): number => {
    switch (view) {
      case 'pt':
        return breakdown.ptFixedApy;
      case 'yt':
        return breakdown.ytApy.longYieldApy;
      case 'lp':
        return breakdown.lpApy.total;
    }
  };

  const getLabel = (): string => {
    switch (view) {
      case 'pt':
        return 'Fixed APY';
      case 'yt':
        return 'Long Yield';
      case 'lp':
        return 'LP APY';
    }
  };

  const apy = getApy();

  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-muted-foreground text-xs">{getLabel()}</span>
      <span className={cn('text-lg font-semibold', getApyColorClass(apy))}>
        {formatApyPercent(apy)}
      </span>
    </div>
  );
}

/**
 * APY Breakdown Card wrapper
 */
interface ApyBreakdownCardProps {
  breakdown: MarketApyBreakdown;
  view: 'pt' | 'yt' | 'lp';
  title?: string;
  className?: string;
}

export function ApyBreakdownCard({
  breakdown,
  view,
  title,
  className,
}: ApyBreakdownCardProps): ReactNode {
  const defaultTitle = view === 'pt' ? 'PT Yield' : view === 'yt' ? 'YT Yield' : 'LP Yield';

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-foreground mb-3 text-sm font-medium">{title ?? defaultTitle}</h3>
        <ApyBreakdown breakdown={breakdown} view={view} />
      </CardContent>
    </Card>
  );
}
