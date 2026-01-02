import { cn } from '@shared/lib/utils';
import type * as React from 'react';

interface CardProps extends React.ComponentProps<'div'> {
  size?: 'default' | 'sm';
  /** Enable interactive hover effects (lift, glow) */
  interactive?: boolean;
}

/**
 * Card component with optional micro-interactions.
 *
 * Features:
 * - `interactive` prop enables hover lift and border glow
 * - Smooth transitions for all state changes
 * - Focus-within ring for keyboard navigation
 */
function Card({
  className,
  size = 'default',
  interactive = false,
  ...props
}: CardProps): React.JSX.Element {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-interactive={interactive ? '' : undefined}
      className={cn(
        // Base styles
        'group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-6 overflow-hidden rounded-2xl py-6 text-sm ring-1',
        // Image handling
        'has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
        // Size variants
        'data-[size=sm]:gap-4 data-[size=sm]:py-4',
        // Micro-interactions: smooth transitions
        'transition-all duration-200 ease-out',
        // Interactive mode: hover effects
        interactive && [
          'cursor-pointer',
          // Lift on hover
          'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5',
          // Border glow on hover
          'hover:ring-primary/20',
          // Active press feedback
          'active:translate-y-0 active:shadow-md active:transition-transform active:duration-75',
          // Focus-within for keyboard nav
          'focus-within:ring-ring/50 focus-within:ring-2',
        ],
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-2 rounded-t-xl px-6 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-6 group-data-[size=sm]/card:[.border-b]:pb-4',
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div data-slot="card-title" className={cn('text-base font-medium', className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="card-content"
      className={cn('px-6 group-data-[size=sm]/card:px-4', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-b-xl px-6 group-data-[size=sm]/card:px-4 [.border-t]:pt-6 group-data-[size=sm]/card:[.border-t]:pt-4',
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
