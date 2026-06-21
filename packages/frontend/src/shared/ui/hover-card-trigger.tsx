'use client';

import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import type { ReactNode } from 'react';

function HoverCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props): ReactNode {
  return <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

export { HoverCardTrigger };
