import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

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

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>): React.ReactNode {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>): React.ReactNode {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        '[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3',
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>): React.ReactNode {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4',
        className
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>): React.ReactNode {
  return (
    <div
      data-slot="alert-action"
      className={cn('absolute top-2.5 right-3', className)}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, alertVariants, AlertTitle };
