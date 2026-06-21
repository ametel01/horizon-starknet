'use client';

import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math';
import { Card, CardContent } from '@shared/ui/Card';
import { AlertCircleIcon, MinusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useYieldClaimPreview } from '../model/useUserYield';
import { FeeRateBadge } from './FeeRateBadge';
import { PreviewRow } from './PreviewRow';
import { PreviewSkeleton } from './PreviewSkeleton';

/**
 * Props for the InterestClaimPreview component
 */
export interface InterestClaimPreviewProps {
  /** YT contract address */
  ytAddress: string | undefined;
  /** SY token symbol for display (e.g., "SY-stETH") */
  sySymbol?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Preview component showing yield claim breakdown with fees.
 *
 * Displays:
 * - Gross yield (before fees)
 * - Protocol fee deduction
 * - Net yield (what user receives)
 *
 * Use this before the claim action to set clear expectations about
 * what the user will receive after protocol fees.
 *
 * @example
 * ```tsx
 * <InterestClaimPreview
 *   ytAddress={market.ytAddress}
 *   sySymbol="SY-stETH"
 * />
 * ```
 */
export function InterestClaimPreview({
  ytAddress,
  sySymbol = 'SY',
  className,
  compact = false,
}: InterestClaimPreviewProps): ReactNode {
  const { data: preview, isLoading, error } = useYieldClaimPreview(ytAddress);

  // Loading state
  if (isLoading) {
    return <PreviewSkeleton className={className} />;
  }

  // Error state - fail gracefully
  if (error) {
    return null;
  }

  // No data or no yield to claim
  if (!preview?.hasYieldToClaim) {
    return null;
  }

  // Format values for display
  const grossFormatted = `${formatWad(preview.grossYield)} ${sySymbol}`;
  const feeFormatted = `−${formatWad(preview.feeAmount)} ${sySymbol}`;
  const netFormatted = `${formatWad(preview.netYield)} ${sySymbol}`;

  // Compact mode: just show net with fee badge
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-foreground font-medium">{netFormatted}</span>
        {preview.feeAmount > 0n && <FeeRateBadge feeRatePercent={preview.feeRatePercent} />}
      </div>
    );
  }

  return (
    <Card className={cn('bg-muted/50 overflow-hidden', className)}>
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">Claim Preview</span>
          {preview.feeAmount > 0n && <FeeRateBadge feeRatePercent={preview.feeRatePercent} />}
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          <PreviewRow
            label="Accumulated yield"
            value={grossFormatted}
            tooltip="Total yield earned from your YT position"
            variant="muted"
          />

          {preview.feeAmount > 0n && (
            <PreviewRow
              label="Protocol fee"
              value={feeFormatted}
              tooltip={`${preview.feeRatePercent} fee sent to protocol treasury`}
              variant="warning"
              icon={<MinusIcon className="size-3" />}
            />
          )}

          <div className="border-border border-t pt-2">
            <PreviewRow
              label="You receive"
              value={netFormatted}
              tooltip="Net amount after fee deduction"
              variant="success"
            />
          </div>
        </div>

        {/* Info note for significant fees */}
        {preview.feeAmount > 0n && preview.feeAmount > preview.netYield / 10n && (
          <div className="bg-warning/10 border-warning/30 flex items-start gap-2 rounded border p-2">
            <AlertCircleIcon className="text-warning mt-0.5 size-4 shrink-0" />
            <p className="text-warning text-xs">
              A {preview.feeRatePercent} protocol fee is applied to all yield claims.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
