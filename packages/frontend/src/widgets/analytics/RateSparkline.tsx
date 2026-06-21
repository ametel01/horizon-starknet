'use client';

import { useMarketRates } from '@features/markets';
import { useDelayedMount } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from '@shared/ui/recharts';
import { SparklineSkeleton } from '@shared/ui/Skeleton';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

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
  const mounted = useDelayedMount();

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
        <Minus className="text-muted-foreground size-3" />
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
              {isPositive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {formatPercent(Math.abs(ratesData.rateChange24h))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
