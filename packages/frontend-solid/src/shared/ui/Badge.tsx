import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

/**
 * Badge variants following Von Restorff Effect and 60-30-10 color rule.
 *
 * Consolidated to 5 semantic core variants + 1 live indicator:
 * - default: Primary accent (use sparingly - 10% rule)
 * - secondary: Neutral information (30% supporting)
 * - success: Positive states (semantic green)
 * - warning: Caution states (semantic amber)
 * - destructive: Error/danger states (semantic red)
 * - outline: Subtle, non-competing (transparent bg)
 * - live: Animated indicator for real-time data
 */
const badgeVariants = cva(
  'h-5 gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium transition-all inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        // Core semantic variants using design tokens
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
        success: 'bg-success/10 text-success dark:bg-success/20',
        warning: 'bg-warning/10 text-warning dark:bg-warning/20',
        outline: 'border-border text-foreground bg-input/30',
        // Live indicator with animation
        live: 'border-success/30 bg-success/10 text-success animate-pulse-subtle',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

function Badge(props: BadgeProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'variant']);

  return (
    <span
      data-slot="badge"
      class={cn(badgeVariants({ variant: local.variant }), local.class)}
      {...others}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
