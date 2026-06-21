import { cn } from '@shared/lib/utils';
import type * as React from 'react';

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>): React.ReactNode {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4',
        className
      )}
      {...props}
    />
  );
}

export { AlertDescription };
