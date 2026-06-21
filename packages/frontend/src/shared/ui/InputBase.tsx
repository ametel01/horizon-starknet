import { cn } from '@shared/lib/utils';
import type * as React from 'react';

/**
 * Input component with focus micro-interactions.
 *
 * Features:
 * - Smooth focus transitions with glow effect
 * - Ring animation on focus
 * - Hover state feedback
 */
function Input({
  className,
  type,
  ref,
  ...props
}: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      type={type}
      ref={ref}
      data-slot="input"
      className={cn(
        // Base styles
        'bg-input/30 border-input flex h-9 w-full rounded-lg border px-3 py-1 text-base',
        // Micro-interactions: smooth transitions
        'transition-all duration-150 ease-out',
        // Hover state
        'hover:border-input/80 hover:bg-input/40',
        // File input styles
        'file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium',
        // Placeholder
        'placeholder:text-muted-foreground placeholder:transition-opacity focus:placeholder:opacity-70',
        // Focus state with glow effect
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        'focus-visible:bg-input/50',
        // Disabled state
        'disabled:hover:border-input disabled:hover:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50',
        // Error state
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-destructive/30',
        // Responsive text
        'md:text-sm',
        className
      )}
      {...props}
    />
  );
}

export { Input };
