import { Card, CardContent } from '@shared/ui/Card';
import type { ReactNode } from 'react';
import type { MarketApyBreakdown } from '@/types/apy';

import { ApyBreakdown } from './ApyBreakdown';

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
