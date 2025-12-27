'use client';

import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';
import { formatPriceImpact, getPriceImpactSeverity } from '@shared/math/amm';

interface PriceImpactMeterProps {
  impact: number;
  className?: string | undefined;
}

/**
 * Visual price impact meter with color-coded severity
 *
 * Shows a progress bar that fills based on price impact percentage.
 * Colors change based on severity: green → yellow → red
 */
export function PriceImpactMeter({ impact, className }: PriceImpactMeterProps): ReactNode {
  const severity = getPriceImpactSeverity(impact);

  // Scale: 0-10% impact = 0-100% width
  const width = Math.min(Math.abs(impact) * 1000, 100);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Price Impact</span>
        <span
          className={cn(
            'font-mono font-medium',
            severity === 'low' && 'text-foreground',
            severity === 'medium' && 'text-warning',
            severity === 'high' && 'text-destructive',
            severity === 'very-high' && 'text-destructive font-semibold'
          )}
        >
          {formatPriceImpact(impact)}
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            severity === 'low' && 'bg-primary',
            severity === 'medium' && 'bg-warning',
            (severity === 'high' || severity === 'very-high') && 'bg-destructive'
          )}
          style={{ width: `${String(width)}%` }}
        />
      </div>
    </div>
  );
}
