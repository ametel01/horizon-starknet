import { Progress as ProgressPrimitive } from '@kobalte/core/progress';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

type ProgressRootProps = ComponentProps<typeof ProgressPrimitive>;

/**
 * Progress root component that contains all progress parts.
 *
 * Uses Kobalte Progress primitive which follows WAI-ARIA Progressbar pattern.
 * - Screen reader announcements
 * - Indeterminate state support
 */
function Progress(props: ProgressRootProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <ProgressPrimitive
      data-slot="progress"
      class={cn('flex flex-wrap gap-3', local.class)}
      {...others}
    >
      {local.children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive>
  );
}

type ProgressTrackProps = ComponentProps<typeof ProgressPrimitive.Track>;

function ProgressTrack(props: ProgressTrackProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      class={cn(
        'bg-muted relative flex h-3 w-full items-center overflow-x-hidden rounded-4xl',
        local.class
      )}
      {...others}
    />
  );
}

type ProgressIndicatorProps = ComponentProps<typeof ProgressPrimitive.Fill>;

function ProgressIndicator(props: ProgressIndicatorProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <ProgressPrimitive.Fill
      data-slot="progress-indicator"
      class={cn('bg-primary h-full transition-all', local.class)}
      {...others}
    />
  );
}

type ProgressLabelProps = ComponentProps<typeof ProgressPrimitive.Label>;

function ProgressLabel(props: ProgressLabelProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      class={cn('text-sm font-medium', local.class)}
      {...others}
    />
  );
}

type ProgressValueLabelProps = ComponentProps<typeof ProgressPrimitive.ValueLabel>;

function ProgressValue(props: ProgressValueLabelProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <ProgressPrimitive.ValueLabel
      data-slot="progress-value"
      class={cn('text-muted-foreground ml-auto text-sm tabular-nums', local.class)}
      {...others}
    />
  );
}

// Export Kobalte primitive for direct access
export { ProgressPrimitive };

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
export type {
  ProgressRootProps,
  ProgressTrackProps,
  ProgressIndicatorProps,
  ProgressLabelProps,
  ProgressValueLabelProps,
};
