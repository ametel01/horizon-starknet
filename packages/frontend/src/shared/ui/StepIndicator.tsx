'use client';

import { cn } from '@shared/lib/utils';
import { memo, type ReactNode } from 'react';

/**
 * Compact horizontal step indicator for inline use
 */
export const StepIndicator = memo(function StepIndicator({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}): ReactNode {
  const stepNumbers = Array.from({ length: total }, (_, stepIndex) => stepIndex + 1);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {stepNumbers.map((stepNumber) => {
        const index = stepNumber - 1;
        return (
          <div
            key={stepNumber}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              index < current
                ? 'bg-success w-4'
                : index === current
                  ? 'bg-primary w-6'
                  : 'bg-muted w-4'
            )}
          />
        );
      })}
    </div>
  );
});
