import { cn } from '@shared/lib/utils';
import { PercentIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Compact badge showing fee rate
 */
export function FeeRateBadge({
  feeRatePercent,
  className,
}: {
  feeRatePercent: string;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        'bg-warning/20 text-warning inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      <PercentIcon className="size-3" />
      {feeRatePercent} Fee
    </span>
  );
}
