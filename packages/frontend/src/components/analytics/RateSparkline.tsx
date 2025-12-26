'use client';

import { type ReactNode, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { useMarketRates } from '@/hooks/useMarketRates';
import { cn } from '@shared/lib/utils';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format percentage with appropriate precision
 */
function formatPercent(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  if (Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(2)}%`;
}

interface RateSparklineProps {
  marketAddress: string;
  className?: string;
  width?: number | string;
  height?: number;
  days?: number;
  showValue?: boolean;
  showChange?: boolean;
  color?: 'primary' | 'destructive' | 'auto';
}

/**
 * Mini sparkline chart for displaying rate trend in cards.
 * Compact visualization suitable for embedding in market cards or lists.
 */
export function RateSparkline({
  marketAddress,
  className,
  width = 64,
  height = 24,
  days = 7,
  showValue = false,
  showChange = false,
  color = 'auto',
}: RateSparklineProps): ReactNode {
  const { data: ratesData, isLoading } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days,
  });

  const chartData = useMemo(() => {
    if (!ratesData) return [];
    return ratesData.dataPoints.map((point) => ({
      rate: point.impliedRatePercent,
    }));
  }, [ratesData]);

  // Determine trend color
  const trendColor = useMemo(() => {
    if (color !== 'auto') return color;
    if (!ratesData || ratesData.dataPoints.length < 2) return 'primary';
    return ratesData.rateChange24h >= 0 ? 'primary' : 'destructive';
  }, [color, ratesData]);

  const strokeColor = trendColor === 'destructive' ? 'var(--destructive)' : 'var(--primary)';
  const fillId = `sparkline-gradient-${marketAddress.slice(0, 8)}`;

  if (isLoading) {
    return <Skeleton className={cn('rounded', className)} style={{ width, height }} />;
  }

  if (!ratesData || chartData.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="rate"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#${fillId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {(showValue || showChange) && (
        <div className="flex flex-col text-right">
          {showValue && (
            <span className="text-foreground text-sm font-medium">
              {formatPercent(ratesData.currentRate)}
            </span>
          )}
          {showChange && ratesData.rateChange24h !== 0 && (
            <span
              className={cn(
                'text-xs',
                ratesData.rateChange24h >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {ratesData.rateChange24h >= 0 ? '+' : ''}
              {formatPercent(ratesData.rateChange24h)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Larger sparkline variant with more detail
 */
interface RateSparklineLargeProps {
  marketAddress: string;
  className?: string;
  height?: number;
  days?: number;
}

export function RateSparklineLarge({
  marketAddress,
  className,
  height = 48,
  days = 30,
}: RateSparklineLargeProps): ReactNode {
  const { data: ratesData, isLoading } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days,
  });

  const chartData = useMemo(() => {
    if (!ratesData) return [];
    return ratesData.dataPoints.map((point) => ({
      rate: point.impliedRatePercent,
    }));
  }, [ratesData]);

  const trendColor = useMemo(() => {
    if (!ratesData || ratesData.dataPoints.length < 2) return 'var(--primary)';
    return ratesData.rateChange24h >= 0 ? 'var(--primary)' : 'var(--destructive)';
  }, [ratesData]);

  const fillId = `sparkline-large-gradient-${marketAddress.slice(0, 8)}`;

  if (isLoading) {
    return <Skeleton className={cn('w-full rounded', className)} style={{ height }} />;
  }

  if (!ratesData || chartData.length === 0) {
    return (
      <div
        className={cn('bg-muted/50 flex w-full items-center justify-center rounded', className)}
        style={{ height }}
      >
        <span className="text-muted-foreground text-xs">No data</span>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="rate"
            stroke={trendColor}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Rate badge with sparkline - compact display for market lists
 */
interface RateBadgeWithSparklineProps {
  marketAddress: string;
  className?: string;
}

export function RateBadgeWithSparkline({
  marketAddress,
  className,
}: RateBadgeWithSparklineProps): ReactNode {
  const { data: ratesData, isLoading } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days: 7,
  });

  const chartData = useMemo(() => {
    if (!ratesData) return [];
    return ratesData.dataPoints.map((point) => ({
      rate: point.impliedRatePercent,
    }));
  }, [ratesData]);

  if (isLoading) {
    return <Skeleton className={cn('h-8 w-24 rounded', className)} />;
  }

  if (!ratesData || chartData.length === 0) {
    return null;
  }

  const isPositive = ratesData.rateChange24h >= 0;
  const strokeColor = isPositive ? 'var(--primary)' : 'var(--destructive)';
  const fillId = `badge-sparkline-${marketAddress.slice(0, 8)}`;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2 py-1',
        isPositive ? 'border-primary/20 bg-primary/5' : 'border-destructive/20 bg-destructive/5',
        className
      )}
    >
      <div className="h-4 w-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="rate"
              stroke={strokeColor}
              strokeWidth={1}
              fill={`url(#${fillId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <span className="text-foreground text-sm font-medium">
        {formatPercent(ratesData.currentRate)}
      </span>
      <span className={cn('text-xs', isPositive ? 'text-primary' : 'text-destructive')}>
        {isPositive ? '+' : ''}
        {formatPercent(ratesData.rateChange24h)}
      </span>
    </div>
  );
}
