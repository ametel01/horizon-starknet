import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

/**
 * Alert variants following the project's semantic color system.
 *
 * Variants:
 * - default: Neutral information
 * - destructive: Error/danger states (semantic red)
 * - warning: Caution states (semantic amber)
 * - info: Informational states (semantic blue)
 */
const alertVariants = cva(
  'grid gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*="size-"])]:size-4 w-full relative group/alert',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-destructive/10 border-destructive/30 *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current',
        warning:
          'text-warning bg-warning/10 border-warning/30 *:data-[slot=alert-description]:text-warning/90 *:[svg]:text-current',
        info: 'text-blue-500 bg-blue-500/10 border-blue-500/30 *:data-[slot=alert-description]:text-blue-500/90 *:[svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type AlertProps = ComponentProps<'div'> & VariantProps<typeof alertVariants>;

function Alert(props: AlertProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'variant']);

  return (
    <div
      data-slot="alert"
      role="alert"
      class={cn(alertVariants({ variant: local.variant }), local.class)}
      {...others}
    />
  );
}

type AlertTitleProps = ComponentProps<'div'>;

function AlertTitle(props: AlertTitleProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="alert-title"
      class={cn(
        '[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3',
        local.class
      )}
      {...others}
    />
  );
}

type AlertDescriptionProps = ComponentProps<'div'>;

function AlertDescription(props: AlertDescriptionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="alert-description"
      class={cn(
        'text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4',
        local.class
      )}
      {...others}
    />
  );
}

type AlertActionProps = ComponentProps<'div'>;

function AlertAction(props: AlertActionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="alert-action"
      class={cn('absolute top-2.5 right-3', local.class)}
      {...others}
    />
  );
}

export { Alert, AlertAction, AlertDescription, alertVariants, AlertTitle };
export type { AlertProps, AlertTitleProps, AlertDescriptionProps, AlertActionProps };
