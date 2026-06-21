'use client';

import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

import { Card, CardContent } from './Card';
import { Skeleton } from './Skeleton';

/**
 * Skeleton version of StatCard for loading states
 */
export function StatCardSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean | undefined;
  className?: string | undefined;
}): ReactNode {
  return (
    <Card className={className}>
      <CardContent className={cn(compact ? 'p-4' : 'p-5')}>
        <Skeleton className="h-3 w-16" />
        <Skeleton className={cn('mt-3 w-24', compact ? 'h-6' : 'h-8')} />
      </CardContent>
    </Card>
  );
}
