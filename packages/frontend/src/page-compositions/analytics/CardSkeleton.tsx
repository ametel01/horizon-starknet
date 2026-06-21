import { Skeleton } from '@shared/ui';
import type { ReactNode } from 'react';

export function CardSkeleton(): ReactNode {
  return <Skeleton className="h-[200px] w-full rounded-lg" />;
}
