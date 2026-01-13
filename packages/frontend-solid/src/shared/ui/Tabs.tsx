import { Tabs } from '@kobalte/core/tabs';
import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

// In Kobalte, Tabs itself is the Root component
type TabsRootProps = ComponentProps<typeof Tabs> & {
  /** Orientation of the tabs */
  orientation?: 'horizontal' | 'vertical';
};

/**
 * Tabs root component that contains all tabs parts.
 *
 * Uses Kobalte Tabs primitive which follows WAI-ARIA Tabs pattern.
 * - Keyboard navigation (arrow keys)
 * - Screen reader support
 * - Automatic/manual activation modes
 */
function TabsRoot(props: TabsRootProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'orientation']);
  const orientation = () => local.orientation ?? 'horizontal';

  return (
    <Tabs
      data-slot="tabs"
      data-orientation={orientation()}
      class={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', local.class)}
      orientation={orientation()}
      {...others}
    />
  );
}

const tabsListVariants = cva(
  'rounded-4xl p-[3px] group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:rounded-2xl data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TabsListProps = ComponentProps<typeof Tabs.List> & VariantProps<typeof tabsListVariants>;

function TabsList(props: TabsListProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'variant']);

  return (
    <Tabs.List
      data-slot="tabs-list"
      data-variant={local.variant ?? 'default'}
      class={cn(tabsListVariants({ variant: local.variant }), local.class)}
      {...others}
    />
  );
}

type TabsTriggerProps = ComponentProps<typeof Tabs.Trigger>;

function TabsTrigger(props: TabsTriggerProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Tabs.Trigger
      data-slot="tabs-trigger"
      class={cn(
        // Base styles
        'focus-visible:ring-ring/50 text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground',
        'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all',
        'group-data-[orientation=vertical]/tabs:px-2.5 group-data-[orientation=vertical]/tabs:py-1.5 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start',
        'focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Line variant styles (when parent has data-variant=line)
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[selected]:bg-transparent',
        'dark:group-data-[variant=line]/tabs-list:data-[selected]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[selected]:bg-transparent',
        // Selected state styles (Kobalte uses data-selected instead of data-active)
        'data-[selected]:bg-background dark:data-[selected]:text-foreground dark:data-[selected]:border-input dark:data-[selected]:bg-input/30 data-[selected]:text-foreground',
        // Line indicator (pseudo-element)
        'after:bg-foreground after:absolute after:opacity-0 after:transition-opacity',
        'group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5',
        'group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5',
        'group-data-[variant=line]/tabs-list:data-[selected]:after:opacity-100',
        local.class
      )}
      {...others}
    />
  );
}

type TabsContentProps = ComponentProps<typeof Tabs.Content>;

function TabsContent(props: TabsContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Tabs.Content
      data-slot="tabs-content"
      class={cn('flex-1 text-sm outline-none', local.class)}
      {...others}
    />
  );
}

type TabsIndicatorProps = ComponentProps<typeof Tabs.Indicator>;

function TabsIndicator(props: TabsIndicatorProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Tabs.Indicator
      data-slot="tabs-indicator"
      class={cn('absolute transition-all duration-200', local.class)}
      {...others}
    />
  );
}

// Export Tabs namespace for direct access to Kobalte primitives
// Usage: Tabs.Root, Tabs.Trigger, etc.
export { Tabs };

// Export wrapper components
export { TabsRoot, TabsList, TabsTrigger, TabsContent, TabsIndicator, tabsListVariants };

export type {
  TabsRootProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  TabsIndicatorProps,
};
