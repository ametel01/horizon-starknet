import { cn } from '@shared/lib/utils';
import { For, type JSX, Show } from 'solid-js';

export interface Step {
  label: string;
  description?: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  class?: string;
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
function StepProgress(props: StepProgressProps): JSX.Element {
  return (
    <div
      class={cn('w-full', props.class)}
      role="progressbar"
      aria-valuenow={props.currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={props.steps.length}
    >
      {/* Step indicators */}
      <div class="flex items-center justify-between">
        <For each={props.steps}>
          {(step, index) => {
            const isCompleted = () => index() < props.currentStep;
            const isCurrent = () => index() === props.currentStep;
            const isPending = () => index() > props.currentStep;

            return (
              <div class="flex flex-1 items-center">
                {/* Step circle */}
                <div class="flex flex-col items-center">
                  <div
                    class={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300',
                      isCompleted() && 'bg-success text-success-foreground',
                      isCurrent() && 'bg-primary text-primary-foreground ring-primary/20 ring-4',
                      isPending() && 'bg-muted text-muted-foreground'
                    )}
                    aria-current={isCurrent() ? 'step' : undefined}
                  >
                    <Show when={isCompleted()} fallback={<span>{index() + 1}</span>}>
                      {/* Check icon */}
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </Show>
                  </div>
                  {/* Step label */}
                  <span
                    class={cn(
                      'mt-2 text-center text-xs font-medium transition-colors',
                      isCompleted() && 'text-success',
                      isCurrent() && 'text-primary',
                      isPending() && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                <Show when={index() < props.steps.length - 1}>
                  <div class="mx-2 h-0.5 flex-1">
                    <div
                      class={cn(
                        'h-full transition-all duration-500',
                        index() < props.currentStep ? 'bg-success' : 'bg-muted'
                      )}
                    />
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Current step description */}
      <Show when={props.steps[props.currentStep]?.description}>
        <p class="text-muted-foreground mt-4 text-center text-sm">
          {props.steps[props.currentStep]?.description}
        </p>
      </Show>
    </div>
  );
}

/**
 * Compact horizontal step indicator for inline use
 */
interface StepIndicatorProps {
  current: number;
  total: number;
  class?: string;
}

function StepIndicator(props: StepIndicatorProps): JSX.Element {
  return (
    <div class={cn('flex items-center gap-1.5', props.class)}>
      <For each={Array.from({ length: props.total })}>
        {(_, index) => (
          <div
            class={cn(
              'h-1.5 rounded-full transition-all duration-300',
              index() < props.current
                ? 'bg-success w-4'
                : index() === props.current
                  ? 'bg-primary w-6'
                  : 'bg-muted w-4'
            )}
          />
        )}
      </For>
    </div>
  );
}

/**
 * Minimal step counter for space-constrained areas
 */
interface StepCounterProps {
  current: number;
  total: number;
  class?: string;
}

function StepCounter(props: StepCounterProps): JSX.Element {
  return (
    <span class={cn('text-muted-foreground text-sm', props.class)}>
      Step <span class="text-foreground font-medium">{props.current}</span> of{' '}
      <span class="text-foreground font-medium">{props.total}</span>
    </span>
  );
}

export { StepProgress, StepIndicator, StepCounter };
export type { StepProgressProps, StepIndicatorProps, StepCounterProps };
