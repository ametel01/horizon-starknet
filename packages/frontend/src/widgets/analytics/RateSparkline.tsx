'use client';

import { useMarketRates } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { Skeleton, SparklineSkeleton, StatCardSkeleton } from '@shared/ui/Skeleton';
import { ArrowDown, ArrowUp, Minus, TrendingUp } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
    return <SparklineSkeleton className={className} width={width} height={height} />;
  }

  if (!ratesData || chartData.length === 0) {
    return (
      <div
        className={cn('bg-muted/50 flex items-center justify-center rounded', className)}
        style={{ width: typeof width === 'number' ? width : undefined, height }}
      >
        <Minus className="text-muted-foreground h-3 w-3" />
      </div>
    );
  }

  const isPositive = ratesData.rateChange24h >= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-2 transition-opacity duration-300',
        mounted ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
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
        <div className="flex flex-col items-end">
          {showValue && (
            <span className="text-foreground font-mono text-sm font-medium">
              {formatPercent(ratesData.currentRate)}
            </span>
          )}
          {showChange && ratesData.rateChange24h !== 0 && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                isPositive ? 'text-primary' : 'text-destructive'
              )}
            >
              {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {formatPercent(Math.abs(ratesData.rateChange24h))}
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
    return <SparklineSkeleton className={cn('w-full', className)} width="100%" height={height} />;
  }

  if (!ratesData || chartData.length === 0) {
    return (
      <div
        className={cn('bg-muted/50 flex w-full items-center justify-center rounded', className)}
        style={{ height }}
      >
        <Minus className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground ml-1 text-xs">No data</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full transition-opacity duration-300',
        mounted ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0.05} />
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
    return <Skeleton className={cn('h-8 w-28 rounded-lg', className)} />;
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
        'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all duration-300',
        isPositive ? 'border-primary/20 bg-primary/5' : 'border-destructive/20 bg-destructive/5',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        className
      )}
    >
      <div className="h-5 w-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
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
      <div className="flex flex-col">
        <span className="text-foreground font-mono text-sm leading-tight font-medium">
          {formatPercent(ratesData.currentRate)}
        </span>
        <span
          className={cn(
            'flex items-center gap-0.5 text-xs leading-tight font-medium',
            isPositive ? 'text-primary' : 'text-destructive'
          )}
        >
          {isPositive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
          {formatPercent(Math.abs(ratesData.rateChange24h))}
        </span>
      </div>
    </div>
  );
}

/**
 * Rate card with sparkline background
 */
interface RateSparklineCardProps {
  marketAddress: string;
  label?: string;
  className?: string;
}

export function RateSparklineCard({
  marketAddress,
  label = 'Implied Rate',
  className,
}: RateSparklineCardProps): ReactNode {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const { data: ratesData, isLoading } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days: 14,
  });

  const chartData = useMemo(() => {
    if (!ratesData) return [];
    return ratesData.dataPoints.map((point) => ({
      rate: point.impliedRatePercent,
    }));
  }, [ratesData]);

  if (isLoading) {
    return <StatCardSkeleton className={className} />;
  }

  if (!ratesData || chartData.length === 0) {
    return (
      <div
        className={cn(
          'border-border/50 bg-card flex items-center justify-center overflow-hidden rounded-xl border p-4',
          className
        )}
      >
        <Minus className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground ml-1 text-sm">No rate data</span>
      </div>
    );
  }

  const isPositive = ratesData.rateChange24h >= 0;
  const strokeColor = isPositive ? 'var(--primary)' : 'var(--destructive)';
  const fillId = `card-sparkline-${marketAddress.slice(0, 8)}`;

  return (
    <div
      className={cn(
        'border-border/50 bg-card relative overflow-hidden rounded-xl border p-4',
        'transition-all duration-500',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}
    >
      {/* Background sparkline */}
      <div className="absolute inset-0 flex items-end opacity-40">
        <ResponsiveContainer width="100%" height="60%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
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

      {/* Content */}
      <div className="relative z-10">
        <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
          <TrendingUp className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-foreground font-mono text-2xl font-bold">
            {formatPercent(ratesData.currentRate)}
          </span>
          <span
            className={cn(
              'flex items-center gap-0.5 text-sm font-medium',
              isPositive ? 'text-primary' : 'text-destructive'
            )}
          >
            {isPositive ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
            {formatPercent(Math.abs(ratesData.rateChange24h))}
          </span>
        </div>
      </div>
    </div>
  );
}
