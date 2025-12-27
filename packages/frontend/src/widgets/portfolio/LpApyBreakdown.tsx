'use client';

import { type ReactNode, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { MarketData } from '@entities/market';
import { useDashboardMarkets } from '@features/markets';
import { usePositions } from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';

const WAD = 10n ** 18n;

// Default fee rate of 0.3% in WAD
const DEFAULT_FEE_RATE = 3_000_000_000_000_000n;

/**
 * Format APY percentage
 */
function formatApy(value: number): string {
  if (value === 0) return '0%';
  return `${value.toFixed(2)}%`;
}

/**
 * Calculate fee APR from market data
 * fee_apr = (estimated_daily_fees * 365) / tvl * 100
 */
function calculateFeeApr(market: MarketData): number {
  const tvl = market.state.syReserve + market.state.ptReserve;
  if (tvl === 0n) return 0;

  // Estimate daily volume as ~0.5% of TVL (conservative estimate)
  const estimatedDailyVolume = tvl / 200n;
  const dailyFees = (estimatedDailyVolume * DEFAULT_FEE_RATE) / WAD;

  // Annualize: (dailyFees / tvl) * 365 * 100
  const feeApr = (Number(dailyFees) * 365 * 100) / Number(tvl);
  return feeApr;
}

/**
 * Convert implied rate to APY
 */
function impliedRateToApy(lnImpliedRate: bigint): number {
  const lnRate = Number(lnImpliedRate) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100;
}

interface LpBreakdownData {
  market: string;
  symbol: string;
  lpBalance: bigint;
  lpShare: number;
  feeApr: number;
  impliedApy: number;
  totalApy: number;
  userFeeShare: number;
}

interface ChartDataPoint {
  name: string;
  feeApr: number;
  impliedApy: number;
}

/**
 * Custom tooltip for APY breakdown
 */
function ApyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint; dataKey: string; value: number; fill: string }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-foreground mb-2 font-medium">{data.name}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Fee APR:</span>
          <span className="text-primary font-medium">{formatApy(data.feeApr)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Implied APY:</span>
          <span style={{ color: 'var(--chart-2)' }} className="font-medium">
            {formatApy(data.impliedApy)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Total:</span>
          <span className="text-foreground font-medium">
            {formatApy(data.feeApr + data.impliedApy)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * LP position row
 */
function LpRow({ data }: { data: LpBreakdownData }): ReactNode {
  const lpBalanceNum = Number(fromWad(data.lpBalance));

  return (
    <div className="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-foreground text-sm font-medium">{data.symbol}</span>
          <span className="text-muted-foreground text-xs">
            {lpBalanceNum.toFixed(4)} LP ({data.lpShare.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6 text-right">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Fee APR</span>
          <span className="text-primary text-sm font-medium">{formatApy(data.feeApr)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Implied</span>
          <span style={{ color: 'var(--chart-2)' }} className="text-sm font-medium">
            {formatApy(data.impliedApy)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Total APY</span>
          <span className="text-foreground text-sm font-bold">{formatApy(data.totalApy)}</span>
        </div>
      </div>
    </div>
  );
}

interface LpApyBreakdownProps {
  className?: string;
  height?: number;
}

/**
 * LP APY Breakdown widget
 *
 * Shows the decomposition of LP returns into fee APR and implied yield.
 */
export function LpApyBreakdown({ className, height = 200 }: LpApyBreakdownProps): ReactNode {
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { data: portfolioData, isLoading: positionsLoading, isError } = usePositions(markets);

  const isLoading = marketsLoading || positionsLoading;

  // Calculate LP breakdown for each position
  const lpBreakdowns = useMemo((): LpBreakdownData[] => {
    if (!portfolioData) return [];

    const result: LpBreakdownData[] = [];

    for (const pos of portfolioData.positions) {
      if (pos.lpBalance === 0n) continue;

      const market = pos.market;
      const symbol = market.metadata?.yieldTokenSymbol ?? 'Unknown';

      const feeApr = calculateFeeApr(market);
      const impliedApy = impliedRateToApy(market.state.lnImpliedRate);
      const totalApy = feeApr + impliedApy;

      result.push({
        market: market.address,
        symbol: `LP-${symbol}`,
        lpBalance: pos.lpBalance,
        lpShare: pos.lpSharePercent,
        feeApr,
        impliedApy,
        totalApy,
        userFeeShare: (feeApr * pos.lpSharePercent) / 100,
      });
    }

    return result;
  }, [portfolioData]);

  // Format chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    return lpBreakdowns.map((lp) => ({
      name: lp.symbol,
      feeApr: lp.feeApr,
      impliedApy: lp.impliedApy,
    }));
  }, [lpBreakdowns]);

  // Calculate totals
  const { avgFeeApr, avgImpliedApy, avgTotalApy } = useMemo(() => {
    if (lpBreakdowns.length === 0) {
      return { avgFeeApr: 0, avgImpliedApy: 0, avgTotalApy: 0 };
    }

    let totalWeight = 0n;
    let weightedFee = 0;
    let weightedImplied = 0;

    for (const lp of lpBreakdowns) {
      const weight = Number(lp.lpBalance);
      weightedFee += lp.feeApr * weight;
      weightedImplied += lp.impliedApy * weight;
      totalWeight += lp.lpBalance;
    }

    const totalWeightNum = Number(totalWeight);
    if (totalWeightNum === 0) {
      return { avgFeeApr: 0, avgImpliedApy: 0, avgTotalApy: 0 };
    }

    return {
      avgFeeApr: weightedFee / totalWeightNum,
      avgImpliedApy: weightedImplied / totalWeightNum,
      avgTotalApy: (weightedFee + weightedImplied) / totalWeightNum,
    };
  }, [lpBreakdowns]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load LP data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (lpBreakdowns.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>LP APY Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No LP positions found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>LP APY Breakdown</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Fee APR + Implied Yield decomposition
            </p>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">Weighted Avg APY</div>
            <div className="text-foreground text-lg font-bold">{formatApy(avgTotalApy)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stacked bar chart */}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${String(v)}%`}
            />
            <Tooltip content={<ApyTooltip />} />
            <Bar
              dataKey="feeApr"
              stackId="apy"
              fill="var(--primary)"
              radius={[0, 0, 0, 0]}
              name="Fee APR"
            />
            <Bar
              dataKey="impliedApy"
              stackId="apy"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              name="Implied APY"
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Position list */}
        <div className="mt-4 max-h-[200px] overflow-y-auto border-t">
          {lpBreakdowns.map((lp) => (
            <LpRow key={lp.market} data={lp} />
          ))}
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Avg Fee APR</div>
            <div className="text-primary font-medium">{formatApy(avgFeeApr)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg Implied</div>
            <div style={{ color: 'var(--chart-2)' }} className="font-medium">
              {formatApy(avgImpliedApy)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">LP Positions</div>
            <div className="text-foreground font-medium">{lpBreakdowns.length}</div>
          </div>
        </div>

        {/* Educational note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>LP Returns:</strong> Liquidity providers earn from two sources: trading fees
            (Fee APR) and the implied yield from the PT/SY pool composition. Fee APR depends on
            trading volume, while implied APY tracks the market rate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact LP APY indicator
 */
interface LpApyCompactProps {
  marketAddress: string;
  className?: string;
}

export function LpApyCompact({ marketAddress, className }: LpApyCompactProps): ReactNode {
  const { markets, isLoading } = useDashboardMarkets();

  const market = useMemo(() => {
    return markets.find((m) => m.address.toLowerCase() === marketAddress.toLowerCase());
  }, [markets, marketAddress]);

  if (isLoading) {
    return <Skeleton className={cn('h-6 w-20', className)} />;
  }

  if (!market) return null;

  const feeApr = calculateFeeApr(market);
  const impliedApy = impliedRateToApy(market.state.lnImpliedRate);
  const totalApy = feeApr + impliedApy;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
        {formatApy(totalApy)} APY
      </span>
      <span className="text-muted-foreground text-xs">
        ({formatApy(feeApr)} fee + {formatApy(impliedApy)} yield)
      </span>
    </div>
  );
}
