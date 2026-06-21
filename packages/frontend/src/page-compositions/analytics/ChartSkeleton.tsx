import { cn } from '@shared/lib/utils';
import { Skeleton } from '@shared/ui';
import type { ReactNode } from 'react';

export function ChartSkeleton({ height = 'h-[300px]' }: { height?: string }): ReactNode {
  return <Skeleton className={cn(height, 'w-full rounded-lg')} />;
}
