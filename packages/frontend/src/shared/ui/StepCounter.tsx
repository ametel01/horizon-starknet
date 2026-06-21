'use client';

import { cn } from '@shared/lib/utils';
import { memo, type ReactNode } from 'react';

/**
 * Minimal step counter for space-constrained areas
 */
export const StepCounter = memo(function StepCounter({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}): ReactNode {
  return (
    <span className={cn('text-muted-foreground text-sm', className)}>
      Step <span className="text-foreground font-medium">{current}</span> of{' '}
      <span className="text-foreground font-medium">{total}</span>
    </span>
  );
});
