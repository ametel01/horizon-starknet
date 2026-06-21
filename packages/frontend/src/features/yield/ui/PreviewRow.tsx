import { cn } from '@shared/lib/utils';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { PreviewTooltip } from './PreviewTooltip';

const PREVIEW_ROW_VALUE_CLASSES = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  warning: 'text-warning',
  success: 'text-primary font-medium',
};

interface PreviewRowProps {
  label: string;
  value: string;
  tooltip?: string;
  variant?: 'default' | 'muted' | 'warning' | 'success';
  icon?: ReactNode;
}

export function PreviewRow({
  label,
  value,
  tooltip,
  variant = 'default',
  icon,
}: PreviewRowProps): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        {icon}
        {label}
        {tooltip && (
          <PreviewTooltip content={tooltip}>
            <InfoIcon className="size-3 opacity-60" />
          </PreviewTooltip>
        )}
      </span>
      <span className={cn('text-sm', PREVIEW_ROW_VALUE_CLASSES[variant])}>{value}</span>
    </div>
  );
}
