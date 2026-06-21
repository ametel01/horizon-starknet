import { cn } from '@shared/lib/utils';
import type * as React from 'react';

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>): React.ReactNode {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        '[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3',
        className
      )}
      {...props}
    />
  );
}

export { AlertTitle };
