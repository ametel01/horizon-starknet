import { Toast } from '@kobalte/core/toast';
import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type JSX, Match, Switch, splitProps } from 'solid-js';

/** Inline SVG X icon for close button */
function XIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** Inline SVG success checkmark icon */
function CircleCheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Inline SVG info icon */
function InfoIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/** Inline SVG warning triangle icon */
function TriangleAlertIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Inline SVG error octagon X icon */
function OctagonXIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

/** Inline SVG spinner for loading state */
function Loader2Icon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

const toastVariants = cva(
  [
    // Base styles
    'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-xl border p-4 shadow-lg transition-all',
    // Animation classes using Kobalte's data-state attributes
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[swipe=end]:animate-out data-[state=closed]:fade-out-80',
    'data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full',
    'data-[state=open]:sm:slide-in-from-bottom-full',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        success: 'border-success/50 bg-success/10 text-success-foreground',
        error: 'border-destructive/50 bg-destructive/10 text-destructive',
        warning: 'border-warning/50 bg-warning/10 text-warning-foreground',
        info: 'border-info/50 bg-info/10 text-info-foreground',
        loading: 'border-border bg-background text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';

type ToastRootProps = ComponentProps<typeof Toast> &
  VariantProps<typeof toastVariants> & {
    variant?: ToastVariant;
  };

/**
 * Toast root component that wraps Kobalte Toast primitive.
 *
 * Features:
 * - Multiple variants (default, success, error, warning, info, loading)
 * - Accessible with WAI-ARIA Toast pattern
 * - Swipe to dismiss
 * - Auto-dismiss with configurable duration
 */
function ToastRoot(props: ToastRootProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'variant']);

  return (
    <Toast
      data-slot="toast"
      class={cn(toastVariants({ variant: local.variant }), local.class)}
      {...others}
    />
  );
}

type ToastTitleProps = ComponentProps<typeof Toast.Title>;

function ToastTitle(props: ToastTitleProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Toast.Title
      data-slot="toast-title"
      class={cn('text-sm font-semibold', local.class)}
      {...others}
    />
  );
}

type ToastDescriptionProps = ComponentProps<typeof Toast.Description>;

function ToastDescription(props: ToastDescriptionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Toast.Description
      data-slot="toast-description"
      class={cn('text-sm opacity-90', local.class)}
      {...others}
    />
  );
}

type ToastCloseButtonProps = ComponentProps<typeof Toast.CloseButton>;

function ToastCloseButton(props: ToastCloseButtonProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Toast.CloseButton
      data-slot="toast-close"
      class={cn(
        'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity',
        'hover:opacity-100 group-hover:opacity-100',
        'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
        local.class
      )}
      {...others}
    >
      <XIcon class="size-4" />
      <span class="sr-only">Close</span>
    </Toast.CloseButton>
  );
}

type ToastProgressFillProps = ComponentProps<typeof Toast.ProgressFill>;

function ToastProgressFill(props: ToastProgressFillProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Toast.ProgressFill
      data-slot="toast-progress"
      class={cn(
        'bg-primary h-full w-[var(--kb-toast-progress-fill-width)] transition-all',
        local.class
      )}
      {...others}
    />
  );
}

type ToastProgressTrackProps = ComponentProps<typeof Toast.ProgressTrack>;

function ToastProgressTrack(props: ToastProgressTrackProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <Toast.ProgressTrack
      data-slot="toast-progress-track"
      class={cn('absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-muted', local.class)}
      {...others}
    >
      {local.children}
    </Toast.ProgressTrack>
  );
}

/** Toast icon component based on variant */
function ToastIcon(props: { variant?: ToastVariant; class?: string }): JSX.Element {
  const iconClass = () => cn('size-4 shrink-0', props.class);

  return (
    <Switch>
      <Match when={props.variant === 'success'}>
        <CircleCheckIcon class={cn(iconClass(), 'text-success')} />
      </Match>
      <Match when={props.variant === 'error'}>
        <OctagonXIcon class={cn(iconClass(), 'text-destructive')} />
      </Match>
      <Match when={props.variant === 'warning'}>
        <TriangleAlertIcon class={cn(iconClass(), 'text-warning')} />
      </Match>
      <Match when={props.variant === 'info'}>
        <InfoIcon class={cn(iconClass(), 'text-info')} />
      </Match>
      <Match when={props.variant === 'loading'}>
        <Loader2Icon class={cn(iconClass(), 'animate-spin')} />
      </Match>
    </Switch>
  );
}

// Re-export Toast primitive for advanced usage
export { Toast };

// Export wrapper components
export {
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastCloseButton,
  ToastProgressFill,
  ToastProgressTrack,
  ToastIcon,
  toastVariants,
};

export type {
  ToastRootProps,
  ToastTitleProps,
  ToastDescriptionProps,
  ToastCloseButtonProps,
  ToastProgressFillProps,
  ToastProgressTrackProps,
  ToastVariant,
};

// Export icons for external use
export { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon };
