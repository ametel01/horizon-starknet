'use client';

import { Card, CardContent, CardHeader } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import type { ReactNode } from 'react';

/**
 * Loading skeleton for ImpermanentLossCalc
 */
export function ImpermanentLossCalcSkeleton({ className }: { className?: string }): ReactNode {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
