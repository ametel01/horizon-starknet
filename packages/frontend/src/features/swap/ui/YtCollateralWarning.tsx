'use client';

import { formatWad } from '@shared/math/wad';
import { Card, CardContent } from '@shared/ui/Card';
import type { ReactNode } from 'react';

interface YtCollateralWarningProps {
  /** Whether to show this warning (direction === 'sell_yt' && isValidAmount) */
  show: boolean;
  /** SY required as collateral */
  collateralRequired: bigint;
  /** User's SY balance */
  syBalance: bigint | undefined;
  /** Label for SY token */
  syLabel: string;
}

/**
 * Warning card displayed when selling YT, showing collateral requirements.
 * Extracted to reduce SwapForm complexity.
 */
export function YtCollateralWarning({
  show,
  collateralRequired,
  syBalance,
  syLabel,
}: YtCollateralWarningProps): ReactNode {
  if (!show) return null;

  const hasInsufficientCollateral = syBalance !== undefined && collateralRequired > syBalance;

  return (
    <Card className="border-warning/30 bg-warning/10">
      <CardContent className="flex items-start gap-2 p-3 text-sm">
        <WarningIcon />
        <div>
          <p className="text-warning font-medium">Collateral Required</p>
          <p className="text-warning/80 mt-1">
            Selling YT requires {formatWad(collateralRequired, 4)} {syLabel} as temporary
            collateral.
          </p>
          {hasInsufficientCollateral && (
            <p className="text-destructive mt-1">
              Insufficient {syLabel} balance. You have {formatWad(syBalance, 4)}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WarningIcon(): ReactNode {
  return (
    <svg
      className="text-warning mt-0.5 h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
