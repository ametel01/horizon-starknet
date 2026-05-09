'use client';

import { cn } from '@shared/lib/utils';

import type { OracleStatus } from '../model/types';

interface OracleStatusBadgeProps {
  status: OracleStatus | undefined;
  isLoading?: boolean;
  showDetails?: boolean;
  className?: string;
}

/**
 * Visual indicator for oracle readiness state
 *
 * States:
 * - 🟢 Ready: Full TWAP available
 * - 🟡 Partial: Shorter TWAP (building history)
 * - ⚪ Spot-only: No TWAP yet
 */
export function OracleStatusBadge({
  status,
  isLoading = false,
  showDetails = false,
  className,
}: OracleStatusBadgeProps) {
  // Loading state
  if (isLoading || !status) {
    return (
      <div className={cn('inline-flex items-center gap-1', className)}>
        <span className="animate-pulse">⚫</span>
        <span className="text-muted-foreground">Loading&hellip;</span>
      </div>
    );
  }

  const config = getConfig(status);

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <span>{config.icon}</span>
      <span className={config.color}>{config.label}</span>
      {showDetails && config.detail && (
        <span className="text-muted-foreground text-xs">({config.detail})</span>
      )}
    </div>
  );
}

function getConfig(status: OracleStatus) {
  switch (status.state) {
    case 'ready':
      return {
        icon: '🟢',
        label: `${status.duration / 60}m TWAP`,
        color: 'text-success',
        detail: null,
      };
    case 'partial':
      return {
        icon: '🟡',
        label: `${status.availableDuration / 60}m TWAP`,
        color: 'text-warning',
        detail: 'Building oracle history\u2026',
      };
    case 'spot-only':
      return {
        icon: '⚪',
        label: 'Spot',
        color: 'text-muted-foreground',
        detail: `TWAP in ${status.estimatedReadyIn}`,
      };
  }
}

/**
 * Format APY for display with oracle status context
 *
 * @param apy - APY as decimal (e.g., 0.0824)
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatApyWithStatus(apy: number, decimals = 2): string {
  return `${(apy * 100).toFixed(decimals)}%`;
}
