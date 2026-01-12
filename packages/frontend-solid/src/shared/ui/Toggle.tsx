import { ToggleButton as TogglePrimitive } from '@kobalte/core/toggle-button';
import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

const toggleVariants = cva(
  "hover:text-foreground data-[pressed]:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive gap-1 rounded-4xl text-sm font-medium transition-colors [&_svg:not([class*='size-'])]:size-4 group/toggle hover:bg-muted inline-flex items-center justify-center whitespace-nowrap outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-input hover:bg-muted border bg-transparent',
      },
      size: {
        default: 'h-9 min-w-9 rounded-[min(var(--radius-2xl),12px)] px-2.5',
        sm: 'h-8 min-w-8 px-3',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ToggleProps = ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>;

/**
 * Toggle button component for toggling between two states.
 *
 * Uses Kobalte ToggleButton primitive which follows WAI-ARIA pattern.
 * - Keyboard navigation
 * - Screen reader support with aria-pressed
 */
function Toggle(props: ToggleProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'variant', 'size']);

  return (
    <TogglePrimitive
      data-slot="toggle"
      class={cn(
        toggleVariants({ variant: local.variant ?? 'default', size: local.size ?? 'default' }),
        local.class
      )}
      {...others}
    />
  );
}

// Export Kobalte primitive for direct access
export { TogglePrimitive };

export { Toggle, toggleVariants };
export type { ToggleProps };
