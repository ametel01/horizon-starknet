'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMarketRates, type ProcessedRateDataPoint } from '@/hooks/useMarketRates';
import { cn } from '@/lib/utils';

/**
 * Format percentage with appropriate precision
 */
function formatPercent(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  if (Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(2)}%`;
}

/**
 * Format percentage for axis labels (compact)
 */
function formatPercentCompact(value: number): string {
  return `${value.toFixed(1)}%`;
}

type ViewMode = 'line' | 'ohlc';
type Resolution = 'tick' | 'daily';

interface ImpliedRateChartProps {
  marketAddress: string;
  className?: string;
  height?: number;
  showExchangeRate?: boolean;
  showControls?: boolean;
  defaultResolution?: Resolution;
  defaultDays?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  impliedRate: number;
  exchangeRate: number;
  // OHLC data
  open?: number | undefined;
  high?: number | undefined;
  low?: number | undefined;
  close?: number | undefined;
}

/**
 * Line/OHLC chart showing implied rate history for a market.
 * Supports toggle between line view and candlestick view.
 */
export function ImpliedRateChart({
  marketAddress,
  className,
  height = 300,
  showExchangeRate = false,
  showControls = true,
  defaultResolution = 'daily',
  defaultDays = 30,
}: ImpliedRateChartProps): ReactNode {
  const [resolution, setResolution] = useState<Resolution>(defaultResolution);
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [days, setDays] = useState(defaultDays);

  const {
    data: ratesData,
    isLoading,
    isError,
  } = useMarketRates(marketAddress, {
    resolution,
    days,
  });

  // Format data for the chart
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!ratesData) return [];

    return ratesData.dataPoints.map((point: ProcessedRateDataPoint) => ({
      date: point.timestamp.toISOString(),
      displayDate: point.displayDate,
      impliedRate: point.impliedRatePercent,
      exchangeRate: point.exchangeRateNum,
      open: point.ohlc?.open,
      high: point.ohlc?.high,
      low: point.ohlc?.low,
      close: point.ohlc?.close,
    }));
  }, [ratesData]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
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
          <p className="text-destructive text-sm">Failed to load rate data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Implied Rate History</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No rate data available</p>
        </CardContent>
      </Card>
    );
  }

  const hasOhlcData = chartData.some((d) => d.open !== undefined);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Implied Rate (APY)</CardTitle>
          {ratesData && (
            <p className="text-muted-foreground text-sm">
              Current:{' '}
              <span className="text-primary font-medium">
                {formatPercent(ratesData.currentRate)}
              </span>
              {ratesData.rateChange24h !== 0 && (
                <span
                  className={cn(
                    'ml-2 text-xs',
                    ratesData.rateChange24h >= 0 ? 'text-primary' : 'text-destructive'
                  )}
                >
                  {ratesData.rateChange24h >= 0 ? '+' : ''}
                  {formatPercent(ratesData.rateChange24h)} (24h)
                </span>
              )}
            </p>
          )}
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* Resolution toggle */}
            <div className="flex rounded-md border">
              <Button
                variant={resolution === 'daily' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => {
                  setResolution('daily');
                }}
                nativeButton
              >
                Daily
              </Button>
              <Button
                variant={resolution === 'tick' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => {
                  setResolution('tick');
                }}
                nativeButton
              >
                Tick
              </Button>
            </div>

            {/* View mode toggle (only for daily with OHLC) */}
            {resolution === 'daily' && hasOhlcData && (
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === 'line' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => {
                    setViewMode('line');
                  }}
                  nativeButton
                >
                  Line
                </Button>
                <Button
                  variant={viewMode === 'ohlc' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => {
                    setViewMode('ohlc');
                  }}
                  nativeButton
                >
                  OHLC
                </Button>
              </div>
            )}

            {/* Days selector */}
            <select
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
              }}
              className="bg-background border-input h-8 rounded-md border px-2 text-sm"
            >
              <option value={7}>7D</option>
              <option value={30}>30D</option>
              <option value={90}>90D</option>
              <option value={365}>1Y</option>
            </select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {viewMode === 'ohlc' && hasOhlcData ? (
            <OhlcChart data={chartData} showExchangeRate={showExchangeRate} />
          ) : (
            <LineChart data={chartData} showExchangeRate={showExchangeRate} />
          )}
        </ResponsiveContainer>

        {/* Stats summary */}
        {ratesData && (
          <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Min</div>
              <div className="text-foreground font-medium">{formatPercent(ratesData.minRate)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Max</div>
              <div className="text-foreground font-medium">{formatPercent(ratesData.maxRate)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Average</div>
              <div className="text-foreground font-medium">{formatPercent(ratesData.avgRate)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">24h Change</div>
              <div
                className={cn(
                  'font-medium',
                  ratesData.rateChange24h >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {ratesData.rateChange24h >= 0 ? '+' : ''}
                {formatPercent(ratesData.rateChange24h)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Line chart for implied rate
 */
function LineChart({
  data,
  showExchangeRate,
}: {
  data: ChartDataPoint[];
  showExchangeRate: boolean;
}): ReactNode {
  return (
    <ComposedChart
      data={data}
      margin={{ top: 10, right: showExchangeRate ? 50 : 10, left: 0, bottom: 0 }}
    >
      <defs>
        <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
      <YAxis
        yAxisId="rate"
        fontSize={12}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatPercentCompact}
      />
      {showExchangeRate && (
        <YAxis
          yAxisId="exchange"
          orientation="right"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toFixed(3)}
        />
      )}
      <Tooltip
        contentStyle={{ borderRadius: '8px' }}
        formatter={(value: number | undefined, name: string | undefined) => {
          if (name === 'impliedRate') {
            return [formatPercent(value ?? 0), 'Implied Rate'];
          }
          return [(value ?? 0).toFixed(4), 'Exchange Rate'];
        }}
        labelFormatter={(label: string) => label}
      />
      <Area
        yAxisId="rate"
        type="monotone"
        dataKey="impliedRate"
        stroke="var(--primary)"
        strokeWidth={2}
        fill="url(#rateGradient)"
        name="impliedRate"
      />
      {showExchangeRate && (
        <Line
          yAxisId="exchange"
          type="monotone"
          dataKey="exchangeRate"
          stroke="var(--chart-2)"
          strokeWidth={1}
          dot={false}
          name="exchangeRate"
        />
      )}
    </ComposedChart>
  );
}

/**
 * OHLC candlestick chart for implied rate
 */
function OhlcChart({
  data,
  showExchangeRate,
}: {
  data: ChartDataPoint[];
  showExchangeRate: boolean;
}): ReactNode {
  // For OHLC, we need to show candles. Recharts doesn't have native candlestick,
  // so we use stacked bars to simulate it
  const ohlcData = data.map((d) => ({
    ...d,
    // Body of the candle (open to close)
    bodyStart: Math.min(d.open ?? d.impliedRate, d.close ?? d.impliedRate),
    bodyEnd: Math.max(d.open ?? d.impliedRate, d.close ?? d.impliedRate),
    // Wick (low to high)
    wickLow: d.low ?? d.impliedRate,
    wickHigh: d.high ?? d.impliedRate,
    // Color based on close vs open
    isUp: (d.close ?? d.impliedRate) >= (d.open ?? d.impliedRate),
  }));

  return (
    <ComposedChart
      data={ohlcData}
      margin={{ top: 10, right: showExchangeRate ? 50 : 10, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
      <YAxis
        yAxisId="rate"
        fontSize={12}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatPercentCompact}
        domain={['dataMin - 0.5', 'dataMax + 0.5']}
      />
      {showExchangeRate && (
        <YAxis
          yAxisId="exchange"
          orientation="right"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toFixed(3)}
        />
      )}
      <Tooltip
        contentStyle={{ borderRadius: '8px' }}
        formatter={(value: number | undefined, name: string | undefined) => {
          const label =
            name === 'wickHigh'
              ? 'High'
              : name === 'wickLow'
                ? 'Low'
                : name === 'bodyStart'
                  ? 'Open'
                  : name === 'bodyEnd'
                    ? 'Close'
                    : name;
          return [formatPercent(value ?? 0), label];
        }}
        labelFormatter={(label: string) => label}
      />
      {/* Wick (line from low to high) */}
      <Bar
        yAxisId="rate"
        dataKey="wickHigh"
        fill="var(--muted-foreground)"
        maxBarSize={2}
        name="wickHigh"
      />
      {/* Body */}
      <Bar yAxisId="rate" dataKey="bodyEnd" maxBarSize={12} name="bodyEnd" fill="var(--primary)" />
      {showExchangeRate && (
        <Line
          yAxisId="exchange"
          type="monotone"
          dataKey="exchangeRate"
          stroke="var(--chart-2)"
          strokeWidth={1}
          dot={false}
          name="exchangeRate"
        />
      )}
    </ComposedChart>
  );
}

/**
 * Compact version showing just the current rate and mini chart
 */
interface ImpliedRateCompactProps {
  marketAddress: string;
  className?: string;
}

export function ImpliedRateCompact({
  marketAddress,
  className,
}: ImpliedRateCompactProps): ReactNode {
  const { data: ratesData, isLoading } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days: 7,
  });

  if (isLoading) {
    return <Skeleton className={cn('h-12 w-24', className)} />;
  }

  if (!ratesData || ratesData.dataPoints.length === 0) {
    return null;
  }

  const chartData = ratesData.dataPoints.map((point: ProcessedRateDataPoint) => ({
    rate: point.impliedRatePercent,
  }));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-8 w-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="miniRateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="rate"
              stroke="var(--primary)"
              strokeWidth={1}
              fill="url(#miniRateGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-foreground font-medium">{formatPercent(ratesData.currentRate)}</div>
        {ratesData.rateChange24h !== 0 && (
          <div
            className={cn(
              'text-xs',
              ratesData.rateChange24h >= 0 ? 'text-primary' : 'text-destructive'
            )}
          >
            {ratesData.rateChange24h >= 0 ? '+' : ''}
            {formatPercent(ratesData.rateChange24h)}
          </div>
        )}
      </div>
    </div>
  );
}
