'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

import { cn } from '@shared/lib/utils';

function CollapsibleTrigger({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        // Focus indicator for accessibility (Feedback Principle)
        'focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  );
}

export { CollapsibleTrigger };
