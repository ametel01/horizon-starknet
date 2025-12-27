'use client';

import { type ReactNode, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  LineChart,
  Line,
} from 'recharts';

import { useYieldCurve, usePtPriceHistory, type YieldCurveMarket } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Color palette for different underlying assets
 */
const UNDERLYING_COLORS: Record<string, string> = {
  ETH: 'var(--chart-1)',
  WETH: 'var(--chart-1)',
  STRK: 'var(--chart-2)',
  USDC: 'var(--chart-3)',
  USDT: 'var(--chart-4)',
  DAI: 'var(--chart-5)',
};

function getUnderlyingColor(symbol: string): string {
  return UNDERLYING_COLORS[symbol.toUpperCase()] ?? 'var(--primary)';
}

/**
 * Format APY percentage with appropriate precision
 */
function formatApy(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  if (Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

/**
 * Format time to expiry
 */
function formatTimeToExpiry(years: number): string {
  if (years < 0.0833) {
    // Less than 1 month
    const days = Math.round(years * 365);
    return `${String(days)}d`;
  }
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${String(months)}mo`;
  }
  return `${years.toFixed(1)}y`;
}

interface YieldCurveChartProps {
  className?: string;
  height?: number;
  /** Filter to specific underlying symbols */
  underlyings?: string[];
  /** Show expired markets (default: false) */
  showExpired?: boolean;
}

interface ChartDataPoint {
  x: number; // timeToExpiryYears
  y: number; // impliedApyPercent
  market: YieldCurveMarket;
}

/**
 * Custom tooltip for yield curve chart
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const { market } = data;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="mb-2 font-medium">{market.underlyingSymbol} Market</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Implied APY:</span>
          <span className="text-primary font-medium">{formatApy(market.impliedApyPercent)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Time to Expiry:</span>
          <span>{formatTimeToExpiry(market.timeToExpiryYears)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Days Left:</span>
          <span>{Math.round(market.timeToExpiryDays)} days</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">PT Price:</span>
          <span>{market.ptPriceInSy.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for APY history chart (single market)
 */
function ApyHistoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { date: string; impliedApyPercent: number } }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-muted-foreground mb-1 text-xs">{data.date}</div>
      <div className="flex justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Implied APY:</span>
        <span className="text-primary font-medium">{formatApy(data.impliedApyPercent)}</span>
      </div>
    </div>
  );
}

/**
 * Yield Curve (Term Structure) Chart
 *
 * Visualizes the relationship between time to maturity and implied APY
 * across all active markets. This is the primary yield-derivatives-native
 * analytics view, showing term structure at a glance.
 *
 * When only one market exists, shows implied APY over time instead.
 */
export function YieldCurveChart({
  className,
  height = 350,
  underlyings,
  showExpired = false,
}: YieldCurveChartProps): ReactNode {
  const { markets, isLoading, isError } = useYieldCurve();
  const { markets: dashboardMarkets } = useDashboardMarkets();

  // Build a map of market address to symbol from dashboard markets (static config)
  const addressToSymbol = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of dashboardMarkets) {
      if (m.metadata?.yieldTokenSymbol) {
        // Use normalized address for matching
        const normalizedAddr = m.address.toLowerCase();
        map.set(normalizedAddr, m.metadata.yieldTokenSymbol);
      }
    }
    return map;
  }, [dashboardMarkets]);

  // Enhance markets with proper symbols from static config
  const enhancedMarkets = useMemo((): YieldCurveMarket[] => {
    return markets.map((m) => {
      const normalizedAddr = m.address.toLowerCase();
      const symbolFromConfig = addressToSymbol.get(normalizedAddr);
      // Use symbol from static config if API returned 'Unknown'
      const underlyingSymbol =
        m.underlyingSymbol === 'Unknown' && symbolFromConfig
          ? symbolFromConfig
          : m.underlyingSymbol;
      return { ...m, underlyingSymbol };
    });
  }, [markets, addressToSymbol]);

  const enhancedActiveMarkets = useMemo(() => {
    return enhancedMarkets.filter((m) => !m.isExpired);
  }, [enhancedMarkets]);

  // Prepare chart data grouped by underlying
  const { chartDataByUnderlying, allUnderlyings, maxY, maxX } = useMemo(() => {
    const sourceMarkets = showExpired ? enhancedMarkets : enhancedActiveMarkets;
    const filtered = underlyings
      ? sourceMarkets.filter((m) =>
          underlyings.map((u) => u.toUpperCase()).includes(m.underlyingSymbol.toUpperCase())
        )
      : sourceMarkets;

    const byUnderlying = new Map<string, ChartDataPoint[]>();
    let maxApyValue = 0;
    let maxTimeValue = 0;

    for (const market of filtered) {
      const symbol = market.underlyingSymbol;
      if (!byUnderlying.has(symbol)) {
        byUnderlying.set(symbol, []);
      }
      byUnderlying.get(symbol)?.push({
        x: market.timeToExpiryYears,
        y: market.impliedApyPercent,
        market,
      });
      maxApyValue = Math.max(maxApyValue, market.impliedApyPercent);
      maxTimeValue = Math.max(maxTimeValue, market.timeToExpiryYears);
    }

    return {
      chartDataByUnderlying: byUnderlying,
      allUnderlyings: Array.from(byUnderlying.keys()),
      maxY: Math.ceil(maxApyValue * 1.1), // Add 10% headroom
      maxX: Math.ceil(maxTimeValue * 1.1),
    };
  }, [enhancedMarkets, enhancedActiveMarkets, underlyings, showExpired]);

  // Get PT price history for single-market time series view
  const singleMarketAddress =
    enhancedActiveMarkets.length === 1 ? enhancedActiveMarkets[0]?.address : undefined;
  const { dataPoints: apyHistory, isLoading: isApyHistoryLoading } = usePtPriceHistory({
    market: singleMarketAddress,
    days: 90,
    enabled: !!singleMarketAddress,
  });

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
          <p className="text-destructive text-sm">Failed to load yield curve data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (allUnderlyings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Yield Curve</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No active markets available</p>
        </CardContent>
      </Card>
    );
  }

  // Single market case: show APY over time instead of term structure
  const isSingleMarket = enhancedActiveMarkets.length === 1;
  const singleMarket = enhancedActiveMarkets[0];

  if (isSingleMarket && singleMarket) {
    // Format APY history data for chart
    const apyChartData = apyHistory.map((p) => ({
      date: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      impliedApyPercent: p.impliedApyPercent,
    }));

    const hasHistoricalData = apyChartData.length > 1;
    const maxApyValue = Math.max(...apyChartData.map((d) => d.impliedApyPercent), 0);

    return (
      <Card className={className}>
        <CardHeader>
          <div>
            <CardTitle>Implied APY History</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {singleMarket.underlyingSymbol} market -{' '}
              {String(Math.round(singleMarket.timeToExpiryDays))} days to maturity
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isApyHistoryLoading ? (
            <Skeleton className="w-full" style={{ height }} />
          ) : hasHistoricalData ? (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={apyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, Math.ceil(maxApyValue * 1.2) || 10]}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ApyHistoryTooltip />} />
                <Line
                  type="monotone"
                  dataKey="impliedApyPercent"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  name="Implied APY"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Historical data is building up. Check back soon for APY trends.
              </p>
            </div>
          )}

          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Current APY</div>
              <div className="text-primary font-medium">
                {formatApy(singleMarket.impliedApyPercent)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">PT Price</div>
              <div className="text-foreground font-medium">
                {singleMarket.ptPriceInSy.toFixed(4)} SY
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Time to Maturity</div>
              <div className="text-foreground font-medium">
                {formatTimeToExpiry(singleMarket.timeToExpiryYears)}
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-muted/50 mt-4 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">
              <strong>Note:</strong> Term structure visualization requires multiple markets with
              different maturities. Currently showing implied APY history for the single active
              market.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Term Structure</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Implied APY vs time to maturity across all markets
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Time to Expiry"
              domain={[0, maxX || 1]}
              tickFormatter={(v: number) => formatTimeToExpiry(v)}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Time to Maturity',
                position: 'bottom',
                offset: 0,
                style: { fill: 'var(--muted-foreground)', fontSize: 12 },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Implied APY"
              domain={[0, maxY || 10]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Implied APY',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--muted-foreground)', fontSize: 12 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value: string) => (
                <span className="text-foreground text-sm">{value}</span>
              )}
            />

            {/* Reference line at 0% APY */}
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />

            {/* Scatter plots for each underlying */}
            {allUnderlyings.map((symbol) => (
              <Scatter
                key={symbol}
                name={symbol}
                data={chartDataByUnderlying.get(symbol) ?? []}
                fill={getUnderlyingColor(symbol)}
                shape="circle"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Active Markets</div>
            <div className="text-foreground font-medium">{enhancedActiveMarkets.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Underlyings</div>
            <div className="text-foreground font-medium">{allUnderlyings.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg APY</div>
            <div className="text-primary font-medium">
              {formatApy(
                enhancedActiveMarkets.length > 0
                  ? enhancedActiveMarkets.reduce((sum, m) => sum + m.impliedApyPercent, 0) /
                      enhancedActiveMarkets.length
                  : 0
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact yield curve showing just the curve line without detailed info
 */
export function YieldCurveCompact({ className }: { className?: string }): ReactNode {
  const { activeMarkets, isLoading } = useYieldCurve();

  if (isLoading) {
    return <Skeleton className={cn('h-24 w-full', className)} />;
  }

  if (activeMarkets.length === 0) {
    return null;
  }

  // Sort by time to expiry and prepare data
  const sortedMarkets = [...activeMarkets].sort(
    (a, b) => a.timeToExpiryYears - b.timeToExpiryYears
  );

  const chartData = sortedMarkets.map((m) => ({
    x: m.timeToExpiryYears,
    y: m.impliedApyPercent,
  }));

  return (
    <div className={cn('h-24', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis type="number" dataKey="x" hide domain={[0, 'dataMax']} />
          <YAxis type="number" dataKey="y" hide domain={[0, 'dataMax']} />
          <Scatter data={chartData} fill="var(--primary)" shape="circle" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
