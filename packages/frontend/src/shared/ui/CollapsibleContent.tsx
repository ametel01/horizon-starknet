'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>): React.JSX.Element {
  return <CollapsiblePrimitive.Content data-slot="collapsible-content" {...props} />;
}

export { CollapsibleContent };
