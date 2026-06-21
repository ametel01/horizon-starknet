'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props): ReactNode {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn('bg-primary h-full transition-all', className)}
      {...props}
    />
  );
}

export { ProgressIndicator };
