import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cn } from '@shared/lib/utils';
import type { VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type * as React from 'react';

import { buttonVariants } from './Button.variants';

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Show loading spinner and disable button */
    loading?: boolean;
    /** Text to show while loading (defaults to children) */
    loadingText?: React.ReactNode;
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
function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled ?? loading;

  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? '' : undefined}
      className={cn(buttonVariants({ variant, size, className }), loading && 'cursor-wait')}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  );
}

export type { ButtonProps };
export { Button };
