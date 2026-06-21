import { cn } from '@shared/lib/utils';
import { formatApyPercent, getApyColorClass } from '@shared/math/apy-breakdown';
import type { ReactNode } from 'react';
import type { MarketApyBreakdown } from '@/types/apy';

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
