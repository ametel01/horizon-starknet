import { Collapsible as CollapsiblePrimitive } from '@kobalte/core/collapsible';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

type CollapsibleRootProps = ComponentProps<typeof CollapsiblePrimitive>;

/**
 * Collapsible root component that contains all collapsible parts.
 *
 * Uses Kobalte Collapsible primitive which follows WAI-ARIA pattern.
 * - Keyboard navigation (enter/space to toggle)
 * - Screen reader support with aria-expanded
 */
function Collapsible(props: CollapsibleRootProps): JSX.Element {
  return <CollapsiblePrimitive data-slot="collapsible" {...props} />;
}

type CollapsibleTriggerProps = ComponentProps<typeof CollapsiblePrimitive.Trigger>;

function CollapsibleTrigger(props: CollapsibleTriggerProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      class={cn(
        // Focus indicator for accessibility (Feedback Principle)
        'focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        local.class
      )}
      {...others}
    />
  );
}

type CollapsibleContentProps = ComponentProps<typeof CollapsiblePrimitive.Content>;

function CollapsibleContent(props: CollapsibleContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      class={cn(
        // Animation for expand/collapse
        'data-[expanded]:animate-collapsible-down data-[closed]:animate-collapsible-up overflow-hidden',
        local.class
      )}
      {...others}
    />
  );
}

// Export Kobalte primitive for direct access
export { CollapsiblePrimitive };

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
export type { CollapsibleRootProps, CollapsibleTriggerProps, CollapsibleContentProps };
