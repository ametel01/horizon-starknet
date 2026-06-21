import { cn } from '@shared/lib/utils';
import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { badgeVariants } from './badge.variants';

function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>): React.JSX.Element {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge };
