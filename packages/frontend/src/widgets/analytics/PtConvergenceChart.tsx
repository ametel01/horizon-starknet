'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { usePtPriceHistory } from '@features/analytics';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format PT price with appropriate precision
 */
function formatPtPrice(value: number): string {
  if (value >= 0.9999 && value <= 1.0001) return '1.0000';
  return value.toFixed(4);
}

/**
 * Format percentage with appropriate precision
 */
function formatPercent(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  return `${value.toFixed(2)}%`;
}

interface PtConvergenceChartProps {
  marketAddress: string;
  className?: string;
  height?: number;
  showControls?: boolean;
  defaultDays?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  ptPrice: number;
  impliedApy: number;
  daysToExpiry: number;
}

/**
 * Custom tooltip for PT convergence chart
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

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-muted-foreground mb-2 text-xs">{data.displayDate}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">PT Price:</span>
          <span className="text-primary font-medium">{formatPtPrice(data.ptPrice)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Implied APY:</span>
          <span>{formatPercent(data.impliedApy)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Days to Expiry:</span>
          <span>{Math.round(data.daysToExpiry)} days</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Discount to Par:</span>
          <span className={data.ptPrice < 1 ? 'text-primary' : 'text-muted-foreground'}>
            {formatPercent((1 - data.ptPrice) * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * PT Convergence to Par Chart
 *
 * Visualizes how a PT's price approaches 1.0 (par value) as maturity approaches.
 * This is a key yield-derivatives concept: PT always equals 1 SY at expiry.
 */
export function PtConvergenceChart({
  marketAddress,
  className,
  height = 300,
  showControls = true,
  defaultDays = 90,
}: PtConvergenceChartProps): ReactNode {
  const [days, setDays] = useState(defaultDays);

  const {
    dataPoints,
    currentPtPrice,
    currentImpliedApy,
    daysToExpiry,
    underlyingSymbol,
    isExpired,
    isLoading,
    isError,
  } = usePtPriceHistory({ market: marketAddress, days });

  // Format data for the chart
  const chartData = useMemo((): ChartDataPoint[] => {
    return dataPoints.map((point) => ({
      date: point.date,
      displayDate: new Date(point.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      ptPrice: point.ptPriceInSy,
      impliedApy: point.impliedApyPercent,
      daysToExpiry: point.timeToExpiryDays,
    }));
  }, [dataPoints]);

  // Calculate Y-axis domain (focus on price range with some padding)
  const { minPrice, maxPrice } = useMemo(() => {
    if (chartData.length === 0) return { minPrice: 0.9, maxPrice: 1.05 };
    const prices = chartData.map((d) => d.ptPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices, 1); // Always include 1.0
    const padding = (max - min) * 0.1;
    return {
      minPrice: Math.max(0, min - padding),
      maxPrice: max + padding,
    };
  }, [chartData]);

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
          <p className="text-destructive text-sm">Failed to load PT price data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>PT Price History</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No PT price data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>PT Convergence to Par</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {underlyingSymbol && `PT-${underlyingSymbol}`}
            {isExpired ? (
              <span className="text-destructive ml-2">(Expired)</span>
            ) : (
              <span className="ml-2">({Math.round(daysToExpiry)} days to maturity)</span>
            )}
          </p>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
              }}
              className="bg-background border-input h-8 rounded-md border px-2 text-sm"
            >
              <option value={30}>30D</option>
              <option value={90}>90D</option>
              <option value={180}>180D</option>
              <option value={365}>1Y</option>
            </select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ptPriceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              domain={[minPrice, maxPrice]}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Reference line at 1.0 (par value) */}
            <ReferenceLine
              y={1}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 5"
              label={{
                value: 'Par (1.0)',
                position: 'right',
                style: { fill: 'var(--muted-foreground)', fontSize: 11 },
              }}
            />

            <Area
              type="monotone"
              dataKey="ptPrice"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#ptPriceGradient)"
              name="PT Price"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Current stats summary */}
        <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Current Price</div>
            <div className="text-primary font-medium">{formatPtPrice(currentPtPrice)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Discount to Par</div>
            <div
              className={cn('font-medium', currentPtPrice < 1 ? 'text-primary' : 'text-foreground')}
            >
              {formatPercent((1 - currentPtPrice) * 100)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Implied APY</div>
            <div className="text-foreground font-medium">{formatPercent(currentImpliedApy)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Days to Expiry</div>
            <div className={cn('font-medium', isExpired ? 'text-destructive' : 'text-foreground')}>
              {isExpired ? 'Expired' : Math.round(daysToExpiry)}
            </div>
          </div>
        </div>

        {/* Educational note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>PT Convergence:</strong> Principal Tokens trade at a discount to par (1.0)
            before maturity. As expiry approaches, the PT price naturally converges to 1.0 SY. The
            discount represents the market&apos;s implied yield expectation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact PT price indicator showing current price and discount
 */
interface PtPriceCompactProps {
  marketAddress: string;
  className?: string;
}

export function PtPriceCompact({ marketAddress, className }: PtPriceCompactProps): ReactNode {
  const { currentPtPrice, isLoading } = usePtPriceHistory({ market: marketAddress, days: 30 });

  if (isLoading) {
    return <Skeleton className={cn('h-12 w-24', className)} />;
  }

  const discount = (1 - currentPtPrice) * 100;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div>
        <div className="text-muted-foreground text-xs">PT Price</div>
        <div className="text-foreground font-mono text-lg font-medium">
          {formatPtPrice(currentPtPrice)}
        </div>
      </div>
      <div className="border-l pl-3">
        <div className="text-muted-foreground text-xs">Discount</div>
        <div className={cn('font-medium', discount > 0 ? 'text-primary' : 'text-muted-foreground')}>
          {formatPercent(discount)}
        </div>
      </div>
    </div>
  );
}
