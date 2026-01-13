import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

interface CardProps extends ComponentProps<'div'> {
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
function Card(props: CardProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'size', 'interactive']);

  return (
    <div
      data-slot="card"
      data-size={local.size ?? 'default'}
      data-interactive={local.interactive ? '' : undefined}
      class={cn(
        // Base styles
        'group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-6 overflow-hidden rounded-2xl py-6 text-sm ring-1',
        // Image handling
        'has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
        // Size variants
        'data-[size=sm]:gap-4 data-[size=sm]:py-4',
        // Micro-interactions: smooth transitions
        'transition-all duration-200 ease-out',
        // Interactive mode: hover effects
        local.interactive && [
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
        local.class
      )}
      {...others}
    />
  );
}

function CardHeader(props: ComponentProps<'div'>): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="card-header"
      class={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-2 rounded-t-xl px-6 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-6 group-data-[size=sm]/card:[.border-b]:pb-4',
        local.class
      )}
      {...others}
    />
  );
}

function CardTitle(props: ComponentProps<'div'>): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div data-slot="card-title" class={cn('text-base font-medium', local.class)} {...others} />
  );
}

function CardDescription(props: ComponentProps<'div'>): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="card-description"
      class={cn('text-muted-foreground text-sm', local.class)}
      {...others}
    />
  );
}

function CardAction(props: ComponentProps<'div'>): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="card-action"
      class={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', local.class)}
      {...others}
    />
  );
}

function CardContent(props: ComponentProps<'div'>): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="card-content"
      class={cn('px-6 group-data-[size=sm]/card:px-4', local.class)}
      {...others}
    />
  );
}

function CardFooter(props: ComponentProps<'div'>): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div
      data-slot="card-footer"
      class={cn(
        'flex items-center rounded-b-xl px-6 group-data-[size=sm]/card:px-4 [.border-t]:pt-6 group-data-[size=sm]/card:[.border-t]:pt-4',
        local.class
      )}
      {...others}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
