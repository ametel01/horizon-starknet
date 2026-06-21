'use client';

import type { LpPosition } from '@shared/api/types';
import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { type ReactNode, useMemo, useState } from 'react';
import { calculateIl, getIlDirectionStyles } from './impermanentLossMath';

export { IlIndicator } from './IlIndicator';
export { ImpermanentLossCalcSkeleton } from './ImpermanentLossCalcSkeleton';

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
            type="button"
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
        <div className={cn('rounded-lg p-4', getIlDirectionStyles(ilMetrics.ilDirection).bg)}>
          <div className="text-muted-foreground text-xs">
            {ilMetrics.ilDirection === 'loss'
              ? 'Impermanent Loss'
              : ilMetrics.ilDirection === 'gain'
                ? 'Impermanent Gain'
                : 'No Significant IL'}
          </div>
          <div
            className={cn('text-2xl font-bold', getIlDirectionStyles(ilMetrics.ilDirection).text)}
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
                getIlDirectionStyles(ilMetrics.ilDirection).bar
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
