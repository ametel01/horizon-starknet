'use client';

import { type ReactNode, useMemo, useState } from 'react';

import type { LpPosition } from '@shared/api/types';
import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

const WAD = BigInt(10) ** BigInt(18);

/**
 * Calculate impermanent loss for an LP position
 *
 * IL occurs when the price ratio of assets in the pool changes from entry.
 * For PT/SY pools, PT converges to 1 SY at maturity.
 *
 * IL = (HODL Value - LP Value) / HODL Value
 *
 * Where:
 * - HODL Value = initial SY + (initial PT * current PT price)
 * - LP Value = current value of LP tokens in terms of SY
 */
interface IlMetrics {
  // Entry values
  entrySy: bigint;
  entryPt: bigint;
  entryPtPriceInSy: bigint; // PT price in SY at entry

  // Current values
  currentSy: bigint;
  currentPt: bigint;
  currentPtPriceInSy: bigint; // PT price in SY now

  // HODL vs LP comparison
  hodlValueSy: bigint; // Value if just held SY + PT separately
  lpValueSy: bigint; // Current value of LP position in SY

  // IL calculation
  ilAbsolute: bigint; // HODL - LP (positive = loss)
  ilPercent: number; // IL as percentage
  ilDirection: 'loss' | 'gain' | 'neutral';
}

function calculateIl(
  position: LpPosition,
  poolReserves: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLpSupply: bigint;
  }
): IlMetrics | null {
  const totalSyDeposited = BigInt(position.totalSyDeposited);
  const totalPtDeposited = BigInt(position.totalPtDeposited);
  const totalSyWithdrawn = BigInt(position.totalSyWithdrawn);
  const totalPtWithdrawn = BigInt(position.totalPtWithdrawn);
  const currentLpBalance = BigInt(position.netLpBalance);

  // Net deposits (what's still in the pool from this user)
  const netSyDeposited = totalSyDeposited - totalSyWithdrawn;
  const netPtDeposited = totalPtDeposited - totalPtWithdrawn;

  // If no net deposits, no IL to calculate
  if (netSyDeposited <= 0n && netPtDeposited <= 0n) {
    return null;
  }

  // Calculate entry PT price from entry exchange rate
  // If we don't have it, estimate from deposit ratio
  let entryPtPriceInSy: bigint;
  if (position.avgEntryExchangeRate) {
    // Exchange rate is typically SY/PT, so PT price = 1/exchangeRate
    const entryExchangeRate = BigInt(position.avgEntryExchangeRate);
    entryPtPriceInSy = entryExchangeRate > 0n ? (WAD * WAD) / entryExchangeRate : WAD;
  } else if (netPtDeposited > 0n) {
    // Estimate from deposit ratio: assume deposits were at market price
    entryPtPriceInSy = (netSyDeposited * WAD) / netPtDeposited;
  } else {
    entryPtPriceInSy = WAD; // Default to 1:1
  }

  // Calculate current PT price from pool reserves
  // PT price in SY = syReserve / ptReserve (simplified)
  const currentPtPriceInSy =
    poolReserves.ptReserve > 0n ? (poolReserves.syReserve * WAD) / poolReserves.ptReserve : WAD;

  // Calculate LP share of pool
  const lpShare =
    poolReserves.totalLpSupply > 0n ? (currentLpBalance * WAD) / poolReserves.totalLpSupply : 0n;

  // Current LP value in SY
  const currentSyFromLp = (poolReserves.syReserve * lpShare) / WAD;
  const currentPtFromLp = (poolReserves.ptReserve * lpShare) / WAD;
  const lpValueSy = currentSyFromLp + (currentPtFromLp * currentPtPriceInSy) / WAD;

  // HODL value: if user had just held the initial SY + PT
  // HODL = initial SY + (initial PT * current PT price)
  const hodlValueSy = netSyDeposited + (netPtDeposited * currentPtPriceInSy) / WAD;

  // IL calculation
  const ilAbsolute = hodlValueSy - lpValueSy;
  const ilPercent = hodlValueSy > 0n ? (Number(ilAbsolute) / Number(hodlValueSy)) * 100 : 0;

  let ilDirection: 'loss' | 'gain' | 'neutral';
  if (ilAbsolute > WAD / 1000n) {
    ilDirection = 'loss';
  } else if (ilAbsolute < -WAD / 1000n) {
    ilDirection = 'gain';
  } else {
    ilDirection = 'neutral';
  }

  return {
    entrySy: netSyDeposited,
    entryPt: netPtDeposited,
    entryPtPriceInSy,
    currentSy: currentSyFromLp,
    currentPt: currentPtFromLp,
    currentPtPriceInSy,
    hodlValueSy,
    lpValueSy,
    ilAbsolute,
    ilPercent,
    ilDirection,
  };
}

interface ImpermanentLossCalcProps {
  position: LpPosition;
  poolReserves: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLpSupply: bigint;
  };
  className?: string;
}

/**
 * Card showing impermanent loss calculation and visualization
 */
export function ImpermanentLossCalc({
  position,
  poolReserves,
  className,
}: ImpermanentLossCalcProps): ReactNode {
  const [showDetails, setShowDetails] = useState(false);

  const ilMetrics = useMemo(() => calculateIl(position, poolReserves), [position, poolReserves]);

  if (!ilMetrics) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Impermanent Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No active LP position to calculate IL</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Impermanent Loss</span>
          <button
            onClick={() => {
              setShowDetails(!showDetails);
            }}
            className="text-primary text-xs font-normal hover:underline"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IL Summary */}
        <div
          className={cn(
            'rounded-lg p-4',
            ilMetrics.ilDirection === 'loss' && 'bg-destructive/10',
            ilMetrics.ilDirection === 'gain' && 'bg-primary/10',
            ilMetrics.ilDirection === 'neutral' && 'bg-muted/50'
          )}
        >
          <div className="text-muted-foreground text-xs">
            {ilMetrics.ilDirection === 'loss'
              ? 'Impermanent Loss'
              : ilMetrics.ilDirection === 'gain'
                ? 'Impermanent Gain'
                : 'No Significant IL'}
          </div>
          <div
            className={cn(
              'text-2xl font-bold',
              ilMetrics.ilDirection === 'loss' && 'text-destructive',
              ilMetrics.ilDirection === 'gain' && 'text-primary',
              ilMetrics.ilDirection === 'neutral' && 'text-foreground'
            )}
          >
            {ilMetrics.ilDirection !== 'neutral' && (ilMetrics.ilPercent >= 0 ? '-' : '+')}
            {Math.abs(ilMetrics.ilPercent).toFixed(2)}%
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            {ilMetrics.ilDirection === 'loss' ? (
              <>{formatWadCompact(ilMetrics.ilAbsolute)} SY less than HODL</>
            ) : ilMetrics.ilDirection === 'gain' ? (
              <>{formatWadCompact(-ilMetrics.ilAbsolute)} SY more than HODL</>
            ) : (
              'LP value ≈ HODL value'
            )}
          </div>
        </div>

        {/* Visual comparison bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">HODL Value</span>
            <span className="text-foreground font-mono">
              {formatWadCompact(ilMetrics.hodlValueSy)} SY
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-muted-foreground/50 h-full w-full" />
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">LP Value</span>
            <span className="text-foreground font-mono">
              {formatWadCompact(ilMetrics.lpValueSy)} SY
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full transition-all',
                ilMetrics.ilDirection === 'loss' && 'bg-destructive',
                ilMetrics.ilDirection === 'gain' && 'bg-primary',
                ilMetrics.ilDirection === 'neutral' && 'bg-muted-foreground/50'
              )}
              style={{
                width: `${String(Math.min(100, (Number(ilMetrics.lpValueSy) / Number(ilMetrics.hodlValueSy)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Detailed breakdown */}
        {showDetails && (
          <div className="border-border space-y-3 border-t pt-3">
            <div className="text-muted-foreground text-xs font-medium">Entry Position</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">SY Deposited:</span>
                <span className="text-foreground ml-1 font-mono">
                  {formatWadCompact(ilMetrics.entrySy)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">PT Deposited:</span>
                <span className="text-foreground ml-1 font-mono">
                  {formatWadCompact(ilMetrics.entryPt)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Entry PT Price:</span>
                <span className="text-foreground ml-1 font-mono">
                  {formatWad(ilMetrics.entryPtPriceInSy, 4)} SY/PT
                </span>
              </div>
            </div>

            <div className="text-muted-foreground text-xs font-medium">Current Position</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">SY Share:</span>
                <span className="text-foreground ml-1 font-mono">
                  {formatWadCompact(ilMetrics.currentSy)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">PT Share:</span>
                <span className="text-foreground ml-1 font-mono">
                  {formatWadCompact(ilMetrics.currentPt)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Current PT Price:</span>
                <span className="text-foreground ml-1 font-mono">
                  {formatWad(ilMetrics.currentPtPriceInSy, 4)} SY/PT
                </span>
              </div>
            </div>

            <div className="text-muted-foreground text-xs font-medium">Price Change</div>
            <div className="text-sm">
              <span className="text-muted-foreground">PT Price:</span>
              <span
                className={cn(
                  'ml-1 font-mono',
                  ilMetrics.currentPtPriceInSy > ilMetrics.entryPtPriceInSy
                    ? 'text-primary'
                    : ilMetrics.currentPtPriceInSy < ilMetrics.entryPtPriceInSy
                      ? 'text-destructive'
                      : 'text-foreground'
                )}
              >
                {(
                  ((Number(ilMetrics.currentPtPriceInSy) - Number(ilMetrics.entryPtPriceInSy)) /
                    Number(ilMetrics.entryPtPriceInSy)) *
                  100
                ).toFixed(2)}
                %
              </span>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="text-muted-foreground text-xs">
          <p>
            IL occurs when PT/SY ratio changes from your entry. As PT approaches maturity, it
            converges to 1 SY, which may result in predictable IL.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact IL indicator for embedding in position cards
 */
interface IlIndicatorProps {
  position: LpPosition;
  poolReserves?: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLpSupply: bigint;
  };
  className?: string;
}

export function IlIndicator({ position, poolReserves, className }: IlIndicatorProps): ReactNode {
  const ilMetrics = useMemo(() => {
    if (!poolReserves) return null;
    return calculateIl(position, poolReserves);
  }, [position, poolReserves]);

  if (!ilMetrics) {
    return <div className={cn('text-muted-foreground text-sm', className)}>IL: --</div>;
  }

  return (
    <div className={cn('text-sm', className)}>
      <span className="text-muted-foreground">IL: </span>
      <span
        className={cn(
          'font-medium',
          ilMetrics.ilDirection === 'loss' && 'text-destructive',
          ilMetrics.ilDirection === 'gain' && 'text-primary',
          ilMetrics.ilDirection === 'neutral' && 'text-foreground'
        )}
      >
        {ilMetrics.ilDirection !== 'neutral' && (ilMetrics.ilPercent >= 0 ? '-' : '+')}
        {Math.abs(ilMetrics.ilPercent).toFixed(2)}%
      </span>
    </div>
  );
}

/**
 * Loading skeleton for ImpermanentLossCalc
 */
export function ImpermanentLossCalcSkeleton({ className }: { className?: string }): ReactNode {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
