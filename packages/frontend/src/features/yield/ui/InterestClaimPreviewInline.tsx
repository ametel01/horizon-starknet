import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math';
import type { ReactNode } from 'react';

import type { YieldClaimPreview } from '../model/useUserYield';

/**
 * Inline preview variant for use in forms
 */
export function InterestClaimPreviewInline({
  preview,
  sySymbol = 'SY',
  className,
}: {
  preview: YieldClaimPreview;
  sySymbol?: string;
  className?: string;
}): ReactNode {
  if (!preview.hasYieldToClaim) {
    return null;
  }

  return (
    <div className={cn('space-y-1 text-sm', className)}>
      <div className="text-muted-foreground flex justify-between">
        <span>Gross yield</span>
        <span>
          {formatWad(preview.grossYield)} {sySymbol}
        </span>
      </div>
      {preview.feeAmount > 0n && (
        <div className="text-warning flex justify-between">
          <span>Fee ({preview.feeRatePercent})</span>
          <span>
            −{formatWad(preview.feeAmount)} {sySymbol}
          </span>
        </div>
      )}
      <div className="text-foreground flex justify-between font-medium">
        <span>Net</span>
        <span>
          {formatWad(preview.netYield)} {sySymbol}
        </span>
      </div>
    </div>
  );
}
