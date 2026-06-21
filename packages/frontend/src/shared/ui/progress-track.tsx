'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props): ReactNode {
  return (
    <ProgressPrimitive.Track
      className={cn(
        'bg-muted relative flex h-3 w-full items-center overflow-x-hidden rounded-4xl',
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

export { ProgressTrack };
