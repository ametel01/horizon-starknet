'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

import { CollapsibleContent } from './CollapsibleContent';
import { CollapsibleTrigger } from './CollapsibleTrigger';

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>): React.JSX.Element {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
