import { type ComponentProps, type JSX, splitProps } from 'solid-js';
import { Toaster as SolidSonner } from 'solid-sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from './Toast';

/** Props for the Toaster component, inferred from solid-sonner */
type ToasterProps = ComponentProps<typeof SolidSonner>;

export type { ToasterProps };

/**
 * Toaster container component using solid-sonner.
 *
 * Provides sonner-like API for toast notifications with:
 * - Queue management (max visible toasts)
 * - Stacking and positioning
 * - Auto-dismiss with configurable duration
 * - Swipe to dismiss
 * - Custom icons per toast type
 *
 * Place this component once at the app root level.
 *
 * @example
 * ```tsx
 * // In your app root
 * import { Toaster } from '@shared/ui/Toaster';
 *
 * function App() {
 *   return (
 *     <>
 *       <Toaster />
 *       <Routes />
 *     </>
 *   );
 * }
 *
 * // To show a toast from anywhere
 * import { toast } from 'solid-sonner';
 *
 * toast.success('Saved successfully');
 * toast.error('Something went wrong');
 * toast('Default notification');
 * ```
 */
function Toaster(props: ToasterProps): JSX.Element {
  const [local, others] = splitProps(props, ['position', 'toastOptions']);

  return (
    <SolidSonner
      class="toaster group"
      position={local.position ?? 'bottom-right'}
      icons={{
        success: <CircleCheckIcon class="size-4" />,
        info: <InfoIcon class="size-4" />,
        warning: <TriangleAlertIcon class="size-4" />,
        error: <OctagonXIcon class="size-4" />,
        loading: <Loader2Icon class="size-4 animate-spin" />,
      }}
      toastOptions={{
        classes: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl',
          title: 'group-[.toast]:text-foreground group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            'group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border',
          success:
            'group-[.toaster]:border-success/50 group-[.toaster]:bg-success/10 group-[.toaster]:text-success-foreground [&_[data-icon]]:text-success',
          error:
            'group-[.toaster]:border-destructive/50 group-[.toaster]:bg-destructive/10 group-[.toaster]:text-destructive [&_[data-icon]]:text-destructive',
          warning:
            'group-[.toaster]:border-warning/50 group-[.toaster]:bg-warning/10 group-[.toaster]:text-warning-foreground [&_[data-icon]]:text-warning',
          info: 'group-[.toaster]:border-info/50 group-[.toaster]:bg-info/10 group-[.toaster]:text-info-foreground [&_[data-icon]]:text-info',
        },
        ...local.toastOptions,
      }}
      {...others}
    />
  );
}

export { Toaster };

// Re-export toast function from solid-sonner for convenience
export { toast } from 'solid-sonner';
