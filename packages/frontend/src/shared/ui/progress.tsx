'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

import { ProgressIndicator } from './progress-indicator';
import { ProgressTrack } from './progress-track';

function Progress({
  className,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props): ReactNode {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn('flex flex-wrap gap-3', className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

export { Progress, ProgressIndicator, ProgressTrack };
