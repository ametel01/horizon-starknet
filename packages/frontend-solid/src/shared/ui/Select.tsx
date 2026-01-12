import { Select } from '@kobalte/core/select';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

/** Inline SVG chevron down icon */
function ChevronDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Inline SVG check icon */
function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// In Kobalte, Select itself is the Root component
type SelectRootProps<T> = ComponentProps<typeof Select<T>>;

/**
 * Select root component that contains all select parts.
 *
 * Uses Kobalte Select primitive which follows WAI-ARIA Listbox pattern.
 * - Keyboard navigation
 * - Screen reader support
 * - Typeahead search
 */
function SelectRoot<T>(props: SelectRootProps<T>): JSX.Element {
  return <Select data-slot="select" {...props} />;
}

type SelectTriggerProps = ComponentProps<typeof Select.Trigger> & {
  /** Size variant */
  size?: 'sm' | 'default';
};

function SelectTrigger(props: SelectTriggerProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children', 'size']);

  return (
    <Select.Trigger
      data-slot="select-trigger"
      data-size={local.size ?? 'default'}
      class={cn(
        // Base styles
        'border-input data-[placeholder]:text-muted-foreground bg-input/30 dark:hover:bg-input/50',
        'flex w-fit items-center justify-between gap-1.5 rounded-4xl border px-3 py-2 text-sm whitespace-nowrap',
        // Focus styles
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        // Invalid styles
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-[3px]',
        // State styles
        'transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50',
        // Size variants
        'data-[size=default]:h-9 data-[size=sm]:h-8',
        // Value styles
        '*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5',
        // Icon styles
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class
      )}
      {...others}
    >
      {local.children}
      <Select.Icon class="text-muted-foreground pointer-events-none size-4">
        <ChevronDownIcon />
      </Select.Icon>
    </Select.Trigger>
  );
}

type SelectValueProps = ComponentProps<typeof Select.Value>;

function SelectValue(props: SelectValueProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Select.Value
      data-slot="select-value"
      class={cn('flex flex-1 text-left', local.class)}
      {...others}
    />
  );
}

type SelectContentProps = ComponentProps<typeof Select.Content>;

function SelectContent(props: SelectContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Select.Portal>
      <Select.Content
        data-slot="select-content"
        class={cn(
          // Base styles
          'bg-popover text-popover-foreground',
          'relative isolate z-50 min-w-36 origin-[var(--kb-select-content-transform-origin)] overflow-hidden rounded-2xl shadow-2xl',
          'ring-foreground/5 ring-1',
          // Animation using Kobalte's data-expanded/data-closed attributes
          'data-[expanded]:animate-in data-[closed]:animate-out',
          'data-[closed]:fade-out-0 data-[expanded]:fade-in-0',
          'data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95',
          'duration-100',
          local.class
        )}
        {...others}
      >
        <Select.Listbox class="max-h-72 overflow-y-auto p-1" />
      </Select.Content>
    </Select.Portal>
  );
}

type SelectItemProps = ComponentProps<typeof Select.Item>;

function SelectItem(props: SelectItemProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <Select.Item
      data-slot="select-item"
      class={cn(
        // Base styles
        'relative flex w-full cursor-default items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none',
        // Interaction states
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        // Disabled state
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        // Icon styles
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class
      )}
      {...others}
    >
      <Select.ItemLabel class="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {local.children}
      </Select.ItemLabel>
      <Select.ItemIndicator class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon class="pointer-events-none" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

type SelectLabelProps = ComponentProps<typeof Select.Label>;

function SelectLabel(props: SelectLabelProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Select.Label
      data-slot="select-label"
      class={cn('text-muted-foreground px-3 py-2.5 text-xs', local.class)}
      {...others}
    />
  );
}

type SelectSectionProps = ComponentProps<typeof Select.Section>;

function SelectSection(props: SelectSectionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Select.Section
      data-slot="select-section"
      class={cn('scroll-my-1 p-1', local.class)}
      {...others}
    />
  );
}

type SelectDescriptionProps = ComponentProps<typeof Select.Description>;

function SelectDescription(props: SelectDescriptionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Select.Description
      data-slot="select-description"
      class={cn('text-muted-foreground text-sm', local.class)}
      {...others}
    />
  );
}

type SelectErrorMessageProps = ComponentProps<typeof Select.ErrorMessage>;

function SelectErrorMessage(props: SelectErrorMessageProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Select.ErrorMessage
      data-slot="select-error-message"
      class={cn('text-destructive text-sm', local.class)}
      {...others}
    />
  );
}

// Export Select namespace for direct access to Kobalte primitives
// Usage: Select.Root, Select.Trigger, etc.
export { Select };

// Export wrapper components
export {
  SelectContent,
  SelectDescription,
  SelectErrorMessage,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectSection,
  SelectTrigger,
  SelectValue,
};

export type {
  SelectContentProps,
  SelectDescriptionProps,
  SelectErrorMessageProps,
  SelectItemProps,
  SelectLabelProps,
  SelectRootProps,
  SelectSectionProps,
  SelectTriggerProps,
  SelectValueProps,
};
