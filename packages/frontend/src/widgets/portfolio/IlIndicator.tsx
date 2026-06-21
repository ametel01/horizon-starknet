'use client';

import type { LpPosition } from '@shared/api/types';
import { cn } from '@shared/lib/utils';
import { type ReactNode, useMemo } from 'react';

import { calculateIl, getIlDirectionStyles } from './impermanentLossMath';

interface IlIndicatorProps {
  position: LpPosition;
  poolReserves?: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLpSupply: bigint;
  };
  className?: string;
}

/**
 * Compact IL indicator for embedding in position cards
 */
export function IlIndicator({ position, poolReserves, className }: IlIndicatorProps): ReactNode {
  const ilMetrics = useMemo(() => {
    if (!poolReserves) return null;
    return calculateIl(position, poolReserves);
  }, [position, poolReserves]);

  if (!ilMetrics) {
    return <div className={cn('text-muted-foreground text-sm', className)}>IL: --</div>;
  }

  return (
    <div className={cn('text-sm', className)}>
      <span className="text-muted-foreground">IL: </span>
      <span className={cn('font-medium', getIlDirectionStyles(ilMetrics.ilDirection).text)}>
        {ilMetrics.ilDirection !== 'neutral' && (ilMetrics.ilPercent >= 0 ? '-' : '+')}
        {Math.abs(ilMetrics.ilPercent).toFixed(2)}%
      </span>
    </div>
  );
}
