import { Button as ButtonPrimitive } from '@kobalte/core/button';
import { cn } from '@shared/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type JSX, Show, splitProps } from 'solid-js';

const buttonVariants = cva(
  [
    // Base styles
    'inline-flex items-center justify-center whitespace-nowrap rounded-4xl border border-transparent bg-clip-padding text-sm font-medium outline-none select-none shrink-0',
    // Focus styles
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    // Error/invalid styles
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-[3px]',
    // Icon sizing
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    // Disabled state
    'disabled:pointer-events-none disabled:opacity-50',
    // Micro-interactions: smooth transitions
    'transition-all duration-150 ease-out',
    // Micro-interactions: active press feedback
    'active:scale-[0.97] active:transition-transform active:duration-75',
    // Group for nested elements
    'group/button',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/80 hover:shadow-md hover:shadow-primary/20',
        outline:
          'border-border bg-input/30 hover:bg-input/50 hover:text-foreground hover:border-border/80 aria-expanded:bg-muted aria-expanded:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground',
        destructive:
          'bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30',
        link: 'text-primary underline-offset-4 hover:underline active:scale-100',
        // Glow variant for primary actions
        glow: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30',
        // Form-specific variants: combine size, width, and styling for form submit buttons
        // These provide better DX than manually combining size="xl" + className overrides
        'form-primary':
          'h-12 w-full text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25',
        'form-secondary':
          'h-10 w-full bg-secondary text-secondary-foreground hover:bg-secondary/80',
        'form-destructive':
          'h-12 w-full text-base font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default:
          'h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        lg: 'h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xl: 'h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        icon: 'size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/** Inline SVG spinner for loading state (avoids lucide dependency) */
function Loader2(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

type ButtonProps = ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants> & {
    /** Show loading spinner and disable button */
    loading?: boolean;
    /** Text to show while loading (defaults to children) */
    loadingText?: JSX.Element;
  };

/**
 * Interactive button with micro-interactions.
 *
 * Features:
 * - Press feedback (scale down on active)
 * - Smooth hover transitions
 * - Loading state with spinner
 * - Glow variant for primary CTAs
 */
function Button(props: ButtonProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'class',
    'variant',
    'size',
    'loading',
    'loadingText',
    'children',
    'disabled',
  ]);

  const isDisabled = () => local.disabled ?? local.loading;

  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={local.loading ? '' : undefined}
      class={cn(
        buttonVariants({ variant: local.variant, size: local.size }),
        local.loading && 'cursor-wait',
        local.class
      )}
      disabled={isDisabled()}
      {...others}
    >
      <Show when={local.loading} fallback={local.children}>
        <Loader2 class="animate-spin" />
        <span>{local.loadingText ?? local.children}</span>
      </Show>
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
