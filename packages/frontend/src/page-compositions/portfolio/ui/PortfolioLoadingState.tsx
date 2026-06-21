'use client';

import { SkeletonCard } from '@shared/ui/Skeleton';
import type { ReactNode } from 'react';

/**
 * Loading state with skeleton cards.
 */
export function PortfolioLoadingState(): ReactNode {
  return (
    <div className="space-y-4">
      <SkeletonCard className="h-[200px]" />
      <SkeletonCard className="h-[200px]" />
    </div>
  );
}
