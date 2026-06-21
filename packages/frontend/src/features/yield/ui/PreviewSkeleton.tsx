import { cn } from '@shared/lib/utils';
import { Card, CardContent } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import type { ReactNode } from 'react';

/**
 * Loading skeleton for the preview
 */
export function PreviewSkeleton({ className }: { className?: string | undefined }): ReactNode {
  return (
    <Card className={cn('bg-muted/50', className)}>
      <CardContent className="space-y-2 p-4">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
