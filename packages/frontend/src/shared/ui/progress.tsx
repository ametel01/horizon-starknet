'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

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

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props): ReactNode {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn('bg-primary h-full transition-all', className)}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props): ReactNode {
  return (
    <ProgressPrimitive.Label
      className={cn('text-sm font-medium', className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props): ReactNode {
  return (
    <ProgressPrimitive.Value
      className={cn('text-muted-foreground ml-auto text-sm tabular-nums', className)}
      data-slot="progress-value"
      {...props}
    />
  );
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
