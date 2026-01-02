'use client';

import { cn } from '@shared/lib/utils';
import { Check } from 'lucide-react';
import { memo, type ReactNode } from 'react';

export interface Step {
  label: string;
  description?: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

/**
 * StepProgress - Visual progress indicator for multi-step flows
 *
 * Provides clear visual feedback on transaction progress, helping users
 * understand where they are in a multi-step process (Feedback Principle).
 *
 * Usage:
 * ```tsx
 * <StepProgress
 *   steps={[
 *     { label: 'Approve', description: 'Approve token spending' },
 *     { label: 'Deposit', description: 'Deposit to protocol' },
 *     { label: 'Confirm', description: 'Transaction confirmed' },
 *   ]}
 *   currentStep={1}
 * />
 * ```
 */
export const StepProgress = memo(function StepProgress({
  steps,
  currentStep,
  className,
}: StepProgressProps): ReactNode {
  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
    >
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={step.label} className="flex flex-1 items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300',
                    isCompleted && 'bg-success text-success-foreground',
                    isCurrent && 'bg-primary text-primary-foreground ring-primary/20 ring-4',
                    isPending && 'bg-muted text-muted-foreground'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {/* Step label */}
                <span
                  className={cn(
                    'mt-2 text-center text-xs font-medium transition-colors',
                    isCompleted && 'text-success',
                    isCurrent && 'text-primary',
                    isPending && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="mx-2 h-0.5 flex-1">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      index < currentStep ? 'bg-success' : 'bg-muted'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current step description */}
      {steps[currentStep]?.description && (
        <p className="text-muted-foreground mt-4 text-center text-sm">
          {steps[currentStep].description}
        </p>
      )}
    </div>
  );
});

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
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            index < current
              ? 'bg-success w-4'
              : index === current
                ? 'bg-primary w-6'
                : 'bg-muted w-4'
          )}
        />
      ))}
    </div>
  );
});

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
