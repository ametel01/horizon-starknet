'use client';

import type { LpPosition } from '@shared/api/types';
import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { ClientDateText } from '@shared/ui/client-time';
import { Skeleton } from '@shared/ui/Skeleton';
import { type ReactNode, useMemo } from 'react';

const WAD = BigInt(10) ** BigInt(18);

/**
 * Calculate LP P&L metrics from position data
 */
interface LpPnlMetrics {
  // Deposits
  totalSyDeposited: bigint;
  totalPtDeposited: bigint;
  // Withdrawals
  totalSyWithdrawn: bigint;
  totalPtWithdrawn: bigint;
  // Net position (deposits - withdrawals)
  netSyPosition: bigint;
  netPtPosition: bigint;
  // Current LP value (if we have pool data)
  currentLpBalance: bigint;
  // P&L estimation
  netPnlSy: bigint;
  netPnlPt: bigint;
  // Percentages
  pnlPercentSy: number;
  pnlPercentPt: number;
}

function calculateLpPnl(position: LpPosition): LpPnlMetrics {
  const totalSyDeposited = BigInt(position.totalSyDeposited);
  const totalPtDeposited = BigInt(position.totalPtDeposited);
  const totalSyWithdrawn = BigInt(position.totalSyWithdrawn);
  const totalPtWithdrawn = BigInt(position.totalPtWithdrawn);
  const currentLpBalance = BigInt(position.netLpBalance);

  // Net position = deposits - withdrawals
  const netSyPosition = totalSyDeposited - totalSyWithdrawn;
  const netPtPosition = totalPtDeposited - totalPtWithdrawn;

  // For now, P&L is simply what's been withdrawn minus what's been deposited
  // A positive number means profit (more withdrawn than deposited)
  // Note: This doesn't account for current unrealized value of LP tokens
  const netPnlSy = totalSyWithdrawn - totalSyDeposited;
  const netPnlPt = totalPtWithdrawn - totalPtDeposited;

  // Calculate percentages
  const pnlPercentSy =
    totalSyDeposited > 0n ? (Number(netPnlSy) / Number(totalSyDeposited)) * 100 : 0;
  const pnlPercentPt =
    totalPtDeposited > 0n ? (Number(netPnlPt) / Number(totalPtDeposited)) * 100 : 0;

  return {
    totalSyDeposited,
    totalPtDeposited,
    totalSyWithdrawn,
    totalPtWithdrawn,
    netSyPosition,
    netPtPosition,
    currentLpBalance,
    netPnlSy,
    netPnlPt,
    pnlPercentSy,
    pnlPercentPt,
  };
}

interface LpPnlCardProps {
  position: LpPosition;
  className?: string | undefined;
  /** Current pool reserves for value calculation */
  poolReserves?:
    | {
        syReserve: bigint;
        ptReserve: bigint;
        totalLpSupply: bigint;
      }
    | undefined;
}

/**
 * Unrealized P&L section - extracted to reduce complexity.
 */
interface UnrealizedPnlSectionProps {
  unrealizedSy: bigint;
  unrealizedPt: bigint;
  percentSy: number;
  percentPt: number;
}

function UnrealizedPnlSection({
  unrealizedSy,
  unrealizedPt,
  percentSy,
  percentPt,
}: UnrealizedPnlSectionProps): ReactNode {
  return (
    <div className="border-border space-y-2 border-t pt-3">
      <div className="text-muted-foreground text-xs font-medium">Unrealized P&L</div>
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn(
            'rounded-lg p-2',
            unrealizedSy >= 0n ? 'bg-primary/10' : 'bg-destructive/10'
          )}
        >
          <div className="text-muted-foreground text-xs">SY</div>
          <div
            className={cn(
              'font-mono text-sm font-medium',
              unrealizedSy >= 0n ? 'text-primary' : 'text-destructive'
            )}
          >
            {unrealizedSy >= 0n ? '+' : ''}
            {formatWadCompact(unrealizedSy)}
          </div>
          <div className={cn('text-xs', percentSy >= 0 ? 'text-primary' : 'text-destructive')}>
            {percentSy >= 0 ? '+' : ''}
            {percentSy.toFixed(2)}%
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg p-2',
            unrealizedPt >= 0n ? 'bg-primary/10' : 'bg-destructive/10'
          )}
        >
          <div className="text-muted-foreground text-xs">PT</div>
          <div
            className={cn(
              'font-mono text-sm font-medium',
              unrealizedPt >= 0n ? 'text-primary' : 'text-destructive'
            )}
          >
            {unrealizedPt >= 0n ? '+' : ''}
            {formatWadCompact(unrealizedPt)}
          </div>
          <div className={cn('text-xs', percentPt >= 0 ? 'text-primary' : 'text-destructive')}>
            {percentPt >= 0 ? '+' : ''}
            {percentPt.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Card showing P&L summary for an LP position
 */
export function LpPnlCard({ position, className, poolReserves }: LpPnlCardProps): ReactNode {
  const metrics = useMemo(() => calculateLpPnl(position), [position]);

  // Calculate current value of LP tokens if we have pool data
  const currentValue = useMemo(() => {
    if (!poolReserves || poolReserves.totalLpSupply === 0n) return null;

    const { syReserve, ptReserve, totalLpSupply } = poolReserves;
    const lpShare = (metrics.currentLpBalance * WAD) / totalLpSupply;

    const syValue = (syReserve * lpShare) / WAD;
    const ptValue = (ptReserve * lpShare) / WAD;

    return { syValue, ptValue };
  }, [metrics.currentLpBalance, poolReserves]);

  // Calculate unrealized P&L if we have current value
  const unrealizedPnl = useMemo(() => {
    if (!currentValue) return null;

    // Total value = current LP value + already withdrawn
    const totalSyValue = currentValue.syValue + metrics.totalSyWithdrawn;
    const totalPtValue = currentValue.ptValue + metrics.totalPtWithdrawn;

    // P&L = total value - deposits
    const unrealizedSy = totalSyValue - metrics.totalSyDeposited;
    const unrealizedPt = totalPtValue - metrics.totalPtDeposited;

    const percentSy =
      metrics.totalSyDeposited > 0n
        ? (Number(unrealizedSy) / Number(metrics.totalSyDeposited)) * 100
        : 0;
    const percentPt =
      metrics.totalPtDeposited > 0n
        ? (Number(unrealizedPt) / Number(metrics.totalPtDeposited)) * 100
        : 0;

    return { unrealizedSy, unrealizedPt, percentSy, percentPt };
  }, [currentValue, metrics]);

  const symbol = position.underlyingSymbol || 'Token';

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">LP Position P&L</CardTitle>
        <p className="text-muted-foreground text-sm">{symbol} Pool</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current LP Balance */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-muted-foreground text-xs">Current LP Balance</div>
          <div className="text-foreground text-xl font-semibold">
            {formatWadCompact(metrics.currentLpBalance)} LP
          </div>
          {currentValue && (
            <div className="text-muted-foreground mt-1 text-xs">
              ≈ {formatWadCompact(currentValue.syValue)} SY +{' '}
              {formatWadCompact(currentValue.ptValue)} PT
            </div>
          )}
        </div>

        {/* Deposits & Withdrawals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-medium">Total Deposited</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">SY:</span>
                <span className="text-foreground font-mono">
                  {formatWadCompact(metrics.totalSyDeposited)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PT:</span>
                <span className="text-foreground font-mono">
                  {formatWadCompact(metrics.totalPtDeposited)}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-medium">Total Withdrawn</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">SY:</span>
                <span className="text-foreground font-mono">
                  {formatWadCompact(metrics.totalSyWithdrawn)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PT:</span>
                <span className="text-foreground font-mono">
                  {formatWadCompact(metrics.totalPtWithdrawn)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* P&L Summary */}
        {unrealizedPnl && (
          <UnrealizedPnlSection
            unrealizedSy={unrealizedPnl.unrealizedSy}
            unrealizedPt={unrealizedPnl.unrealizedPt}
            percentSy={unrealizedPnl.percentSy}
            percentPt={unrealizedPnl.percentPt}
          />
        )}

        {/* Entry Info */}
        {(position.avgEntryImpliedRate !== null || position.avgEntryExchangeRate !== null) && (
          <div className="border-border space-y-2 border-t pt-3">
            <div className="text-muted-foreground text-xs font-medium">Entry Rates</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {position.avgEntryImpliedRate !== null && (
                <div>
                  <span className="text-muted-foreground">Avg Implied Rate:</span>
                  <span className="text-foreground ml-1 font-mono">
                    {formatWad(BigInt(position.avgEntryImpliedRate), 4)}
                  </span>
                </div>
              )}
              {position.avgEntryExchangeRate !== null && (
                <div>
                  <span className="text-muted-foreground">Avg Exchange Rate:</span>
                  <span className="text-foreground ml-1 font-mono">
                    {formatWad(BigInt(position.avgEntryExchangeRate), 4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Info */}
        <div className="text-muted-foreground text-xs">
          {position.firstMint && (
            <div suppressHydrationWarning>
              First deposit: <ClientDateText value={position.firstMint} />
            </div>
          )}
          {position.lastActivity && (
            <div suppressHydrationWarning>
              Last activity: <ClientDateText value={position.lastActivity} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact P&L display for embedding in position cards
 */
interface LpPnlInlineProps {
  position: LpPosition;
  poolReserves?:
    | {
        syReserve: bigint;
        ptReserve: bigint;
        totalLpSupply: bigint;
      }
    | undefined;
  className?: string | undefined;
}

export function LpPnlInline({ position, poolReserves, className }: LpPnlInlineProps): ReactNode {
  const metrics = useMemo(() => calculateLpPnl(position), [position]);

  // Calculate current value
  const currentValue = useMemo(() => {
    if (!poolReserves || poolReserves.totalLpSupply === 0n) return null;

    const { syReserve, ptReserve, totalLpSupply } = poolReserves;
    const lpShare = (metrics.currentLpBalance * WAD) / totalLpSupply;

    return {
      syValue: (syReserve * lpShare) / WAD,
      ptValue: (ptReserve * lpShare) / WAD,
    };
  }, [metrics.currentLpBalance, poolReserves]);

  // Calculate total P&L
  const totalPnl = useMemo(() => {
    if (!currentValue) return null;

    const totalSyValue = currentValue.syValue + metrics.totalSyWithdrawn;
    const pnlSy = totalSyValue - metrics.totalSyDeposited;
    const percentSy =
      metrics.totalSyDeposited > 0n ? (Number(pnlSy) / Number(metrics.totalSyDeposited)) * 100 : 0;

    return { pnlSy, percentSy };
  }, [currentValue, metrics]);

  if (!totalPnl) {
    return <div className={cn('text-muted-foreground text-sm', className)}>P&L: --</div>;
  }

  const isPositive = totalPnl.pnlSy >= 0n;

  return (
    <div className={cn('text-sm', className)}>
      <span className="text-muted-foreground">P&L: </span>
      <span className={cn('font-medium', isPositive ? 'text-primary' : 'text-destructive')}>
        {isPositive ? '+' : ''}
        {formatWadCompact(totalPnl.pnlSy)} SY ({isPositive ? '+' : ''}
        {totalPnl.percentSy.toFixed(2)}%)
      </span>
    </div>
  );
}

/**
 * Loading skeleton for LpPnlCard
 */
export function LpPnlCardSkeleton({ className }: { className?: string }): ReactNode {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}
