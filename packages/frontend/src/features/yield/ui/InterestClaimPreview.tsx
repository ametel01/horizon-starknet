'use client';

import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math';
import { Card, CardContent } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import { AlertCircleIcon, InfoIcon, MinusIcon, PercentIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useYieldClaimPreview, type YieldClaimPreview } from '../model/useUserYield';

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
 * Tooltip component for info hints
 */
function Tooltip({ content, children }: { content: string; children: ReactNode }): ReactNode {
  return (
    <span className="group relative cursor-help" tabIndex={0} role="button" aria-label={content}>
      {children}
      <span
        className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}

/**
 * Row displaying a label-value pair with optional styling
 */
interface PreviewRowProps {
  label: string;
  value: string;
  tooltip?: string;
  variant?: 'default' | 'muted' | 'warning' | 'success';
  icon?: ReactNode;
}

function PreviewRow({
  label,
  value,
  tooltip,
  variant = 'default',
  icon,
}: PreviewRowProps): ReactNode {
  const valueClasses = {
    default: 'text-foreground',
    muted: 'text-muted-foreground',
    warning: 'text-warning',
    success: 'text-primary font-medium',
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        {icon}
        {label}
        {tooltip && (
          <Tooltip content={tooltip}>
            <InfoIcon className="size-3 opacity-60" />
          </Tooltip>
        )}
      </span>
      <span className={cn('text-sm', valueClasses[variant])}>{value}</span>
    </div>
  );
}

/**
 * Loading skeleton for the preview
 */
function PreviewSkeleton({ className }: { className?: string | undefined }): ReactNode {
  return (
    <Card className={cn('bg-muted/50', className)}>
      <CardContent className="space-y-2 p-4">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

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

export type { YieldClaimPreview };
