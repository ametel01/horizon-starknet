import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@shared/lib/utils';

const badgeVariants = cva(
  'h-5 gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium transition-all inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
        outline: 'border-border text-foreground bg-input/30',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',
        // DeFi-specific variants
        success: 'border-transparent bg-green-500/10 text-green-600 dark:text-green-400',
        warning: 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400',
        live: 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 animate-pulse',
        expiring: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        expired: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>): React.JSX.Element {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
