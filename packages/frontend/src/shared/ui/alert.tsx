import { cn } from '@shared/lib/utils';
import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { alertVariants } from './alert.variants';
import { AlertDescription } from './alert-description';
import { AlertTitle } from './alert-title';

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>): React.ReactNode {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
