import { HoverCard as HoverCardPrimitive } from '@kobalte/core/hover-card';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

type HoverCardRootProps = ComponentProps<typeof HoverCardPrimitive>;

/**
 * HoverCard root component that contains all hover card parts.
 *
 * Uses Kobalte HoverCard primitive for showing content on hover.
 * - Delayed open/close for better UX
 * - Accessible tooltip alternative for rich content
 */
function HoverCard(props: HoverCardRootProps): JSX.Element {
  return <HoverCardPrimitive data-slot="hover-card" {...props} />;
}

type HoverCardTriggerProps = ComponentProps<typeof HoverCardPrimitive.Trigger>;

function HoverCardTrigger(props: HoverCardTriggerProps): JSX.Element {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

type HoverCardPortalProps = ComponentProps<typeof HoverCardPrimitive.Portal>;

function HoverCardPortal(props: HoverCardPortalProps): JSX.Element {
  return <HoverCardPrimitive.Portal data-slot="hover-card-portal" {...props} />;
}

type HoverCardContentProps = ComponentProps<typeof HoverCardPrimitive.Content>;

function HoverCardContent(props: HoverCardContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        class={cn(
          'data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 ring-foreground/5 bg-popover text-popover-foreground z-[100] w-72 rounded-2xl p-4 text-sm shadow-2xl ring-1 outline-hidden duration-100',
          local.class
        )}
        {...others}
      />
    </HoverCardPrimitive.Portal>
  );
}

type HoverCardArrowProps = ComponentProps<typeof HoverCardPrimitive.Arrow>;

function HoverCardArrow(props: HoverCardArrowProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <HoverCardPrimitive.Arrow
      data-slot="hover-card-arrow"
      class={cn('fill-popover', local.class)}
      {...others}
    />
  );
}

// Export Kobalte primitive for direct access
export { HoverCardPrimitive };

export { HoverCard, HoverCardTrigger, HoverCardPortal, HoverCardContent, HoverCardArrow };
export type {
  HoverCardRootProps,
  HoverCardTriggerProps,
  HoverCardPortalProps,
  HoverCardContentProps,
  HoverCardArrowProps,
};
