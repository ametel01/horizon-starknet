import { cn } from '@shared/lib/utils';
import { formatApyPercent, getApyColorClass } from '@shared/math/apy-breakdown';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { ApyTooltip } from './ApyTooltip';

interface ApyRowProps {
  label: string;
  value: number;
  tooltip: string;
  highlight?: boolean;
}

export function ApyRow({ label, value, tooltip, highlight }: ApyRowProps): ReactNode {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1 text-sm">
        {label}
        <ApyTooltip content={tooltip}>
          <InfoIcon className="size-3" />
        </ApyTooltip>
      </span>
      <span
        className={cn('text-sm font-medium', highlight ? 'text-primary' : getApyColorClass(value))}
      >
        {formatApyPercent(value)}
      </span>
    </div>
  );
}
