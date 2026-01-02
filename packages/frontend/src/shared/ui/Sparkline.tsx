'use client';

import { cn } from '@shared/lib/utils';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { memo, type ReactNode, useEffect, useMemo, useState } from 'react';

/**
 * Data point for sparkline charts
 */
export interface SparklineDataPoint {
  value: number;
  label?: string;
}

/**
 * SVG-based sparkline component
 * Lightweight alternative to Recharts for simple trend visualization
 */
interface SparklineProps {
  data: number[] | SparklineDataPoint[];
  width?: number;
  height?: number;
  className?: string;
  /** Line color - defaults to primary */
  color?: 'primary' | 'destructive' | 'warning' | 'muted' | 'auto';
  /** Show gradient fill under the line */
  showFill?: boolean;
  /** Show animated drawing effect */
  animated?: boolean;
  /** Stroke width */
  strokeWidth?: number;
  /** Curve type */
  curve?: 'linear' | 'smooth';
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

/**
 * SVG-based sparkline component
 * Memoized for performance when used in lists
 */
export const Sparkline = memo(function Sparkline({
  data,
  width = 64,
  height = 24,
  className,
  color = 'primary',
  showFill = true,
  animated = true,
  strokeWidth = 1.5,
  curve = 'smooth',
  'aria-label': ariaLabel,
}: SparklineProps): ReactNode {
  const [mounted, setMounted] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setMounted(true);
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [animated]);

  // Normalize data to numbers
  const values = useMemo(() => {
    return data.map((d) => (typeof d === 'number' ? d : d.value));
  }, [data]);

  // Calculate path
  const { linePath, areaPath, gradientId, strokeColor } = useMemo(() => {
    if (values.length < 2) {
      return { linePath: '', areaPath: '', gradientId: '', strokeColor: '' };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Padding
    const paddingX = 2;
    const paddingY = 2;
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    // Generate points
    const points = values.map((v, i) => ({
      x: paddingX + (i / (values.length - 1)) * chartWidth,
      y: paddingY + chartHeight - ((v - min) / range) * chartHeight,
    }));

    // Determine color based on trend
    let resolvedColor = color;
    if (color === 'auto') {
      const first = values[0] ?? 0;
      const last = values[values.length - 1] ?? 0;
      resolvedColor = last >= first ? 'primary' : 'destructive';
    }

    const colorMap: Record<string, string> = {
      primary: 'var(--primary)',
      destructive: 'var(--destructive)',
      warning: 'var(--warning)',
      muted: 'var(--muted-foreground)',
    };

    const stroke = colorMap[resolvedColor] ?? colorMap['primary'];

    // Build path based on curve type
    let pathD: string;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    if (!firstPoint || !lastPoint) {
      return { linePath: '', areaPath: '', gradientId: '', strokeColor: '' };
    }

    if (curve === 'smooth' && points.length > 2) {
      // Catmull-Rom to Bezier conversion for smooth curves
      pathD = `M ${String(firstPoint.x)} ${String(firstPoint.y)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        if (!p0 || !p1 || !p2 || !p3) continue;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        pathD += ` C ${String(cp1x)} ${String(cp1y)}, ${String(cp2x)} ${String(cp2y)}, ${String(p2.x)} ${String(p2.y)}`;
      }
    } else {
      pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${String(p.x)} ${String(p.y)}`)
        .join(' ');
    }

    // Area path (close to bottom)
    const areaD = `${pathD} L ${String(lastPoint.x)} ${String(height - paddingY)} L ${String(paddingX)} ${String(height - paddingY)} Z`;

    const id = `sparkline-${Math.random().toString(36).slice(2, 9)}`;

    return {
      linePath: pathD,
      areaPath: areaD,
      gradientId: id,
      strokeColor: stroke,
    };
  }, [values, width, height, color, curve]);

  // Generate accessible description from data trend (must be before early return)
  const trendDescription = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    if (values.length < 2) return 'No trend data';
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    const change = ((last - first) / (first || 1)) * 100;
    if (Math.abs(change) < 0.1) return 'Trend chart showing stable values';
    return change > 0
      ? `Trend chart showing ${change.toFixed(1)}% increase`
      : `Trend chart showing ${Math.abs(change).toFixed(1)}% decrease`;
  }, [ariaLabel, values]);

  // Calculate path length for animation
  const pathLength = width * 2;

  if (values.length < 2) {
    return (
      <div
        className={cn('bg-muted/50 flex items-center justify-center rounded', className)}
        style={{ width, height }}
        role="img"
        aria-label="Insufficient data for trend"
      >
        <Minus className="text-muted-foreground h-3 w-3" aria-hidden="true" />
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className={cn('overflow-visible', className)}
      // Accessibility: describe the chart for screen readers
      role="img"
      aria-label={trendDescription}
    >
      {showFill && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}

      {/* Fill area */}
      {showFill && (
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          className={cn('transition-opacity duration-500', mounted ? 'opacity-100' : 'opacity-0')}
        />
      )}

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={animated ? pathLength : undefined}
        strokeDashoffset={animated ? (mounted ? 0 : pathLength) : undefined}
        className={animated ? 'transition-[stroke-dashoffset] duration-700 ease-out' : undefined}
      />
    </svg>
  );
});

/**
 * Sparkline with value display
 */
interface SparklineWithValueProps extends SparklineProps {
  /** Current value to display */
  value: string | number;
  /** Change value (e.g., "+5.2%") */
  change?: string | number;
  /** Value label */
  label?: string;
  /** Position of the value display */
  valuePosition?: 'left' | 'right';
}

export const SparklineWithValue = memo(function SparklineWithValue({
  value,
  change,
  label,
  valuePosition = 'right',
  ...sparklineProps
}: SparklineWithValueProps): ReactNode {
  const isPositive = typeof change === 'number' ? change >= 0 : !String(change).startsWith('-');

  return (
    <div className={cn('flex items-center gap-2', valuePosition === 'left' && 'flex-row-reverse')}>
      <Sparkline {...sparklineProps} />
      <div className={cn('flex flex-col', valuePosition === 'left' ? 'items-start' : 'items-end')}>
        {label && <span className="text-muted-foreground text-xs">{label}</span>}
        <span className="text-foreground font-mono text-sm font-medium">{value}</span>
        {change !== undefined && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              isPositive ? 'text-primary' : 'text-destructive'
            )}
          >
            {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {typeof change === 'number' ? `${Math.abs(change).toFixed(2)}%` : change}
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Mini bar chart for volume/distribution data
 */
interface MiniBarChartProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: 'primary' | 'destructive' | 'warning' | 'muted';
  /** Gap between bars as fraction of bar width */
  gap?: number;
  /** Show animated entrance */
  animated?: boolean;
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

/**
 * Mini bar chart for volume/distribution data
 * Memoized for performance when used in lists
 */
export const MiniBarChart = memo(function MiniBarChart({
  data,
  width = 64,
  height = 24,
  className,
  color = 'primary',
  gap = 0.2,
  animated = true,
  'aria-label': ariaLabel,
}: MiniBarChartProps): ReactNode {
  const [mounted, setMounted] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setMounted(true);
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [animated]);

  interface BarData {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
  }

  const bars = useMemo((): BarData[] => {
    if (data.length === 0) return [];

    const max = Math.max(...data);
    if (max === 0) {
      // Return empty bars for zero data
      return [];
    }

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const barWidth = chartWidth / data.length;
    const barInnerWidth = barWidth * (1 - gap);

    const colorMap: Record<string, string> = {
      primary: 'var(--primary)',
      destructive: 'var(--destructive)',
      warning: 'var(--warning)',
      muted: 'var(--muted-foreground)',
    };

    return data.map((v, i) => ({
      x: padding + i * barWidth + (barWidth - barInnerWidth) / 2,
      y: padding + chartHeight - (v / max) * chartHeight,
      width: barInnerWidth,
      height: (v / max) * chartHeight,
      fill: colorMap[color] ?? 'var(--primary)',
    }));
  }, [data, width, height, color, gap]);

  // Generate accessible description from data (must be before early return)
  const chartDescription = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    if (data.length === 0) return 'No data';
    const max = Math.max(...data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return `Bar chart with ${String(data.length)} bars, max value ${max.toFixed(1)}, average ${avg.toFixed(1)}`;
  }, [ariaLabel, data]);

  if (data.length === 0) {
    return (
      <div
        className={cn('bg-muted/50 flex items-center justify-center rounded', className)}
        style={{ width, height }}
        role="img"
        aria-label="No data available"
      >
        <Minus className="text-muted-foreground h-3 w-3" aria-hidden="true" />
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className={className}
      // Accessibility: describe the chart for screen readers
      role="img"
      aria-label={chartDescription}
    >
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={mounted ? bar.y : height - 2}
          width={bar.width}
          height={mounted ? bar.height : 0}
          fill={bar.fill}
          rx={1}
          className="transition-all duration-500 ease-out"
          style={{ transitionDelay: `${String(i * 30)}ms` }}
        />
      ))}
    </svg>
  );
});

/**
 * Trend indicator with arrow and change
 */
interface TrendIndicatorProps {
  value: number;
  className?: string;
  /** Show as percentage */
  isPercentage?: boolean;
  /** Number of decimal places */
  decimals?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show neutral state for zero */
  showNeutral?: boolean;
}

/**
 * Trend indicator with arrow and change
 * Memoized as it's frequently rendered in lists
 */
export const TrendIndicator = memo(function TrendIndicator({
  value,
  className,
  isPercentage = true,
  decimals = 2,
  size = 'md',
  showNeutral = true,
}: TrendIndicatorProps): ReactNode {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  if (isNeutral && showNeutral) {
    return (
      <span
        className={cn(
          'text-muted-foreground inline-flex items-center font-medium',
          sizeClasses[size],
          className
        )}
      >
        <Minus className={iconSizes[size]} />
        {isPercentage ? '0%' : '0'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium',
        isPositive ? 'text-primary' : 'text-destructive',
        sizeClasses[size],
        className
      )}
    >
      {isPositive ? (
        <ArrowUp className={iconSizes[size]} />
      ) : (
        <ArrowDown className={iconSizes[size]} />
      )}
      {isPositive ? '+' : ''}
      {value.toFixed(decimals)}
      {isPercentage ? '%' : ''}
    </span>
  );
});

/**
 * Compact stat with sparkline background
 */
interface SparklineStatProps {
  label: string;
  value: string | number;
  data: number[];
  change?: number;
  className?: string;
}

/**
 * Compact stat with sparkline background
 * Memoized for dashboard performance
 */
export const SparklineStat = memo(function SparklineStat({
  label,
  value,
  data,
  change,
  className,
}: SparklineStatProps): ReactNode {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border p-3',
        'border-border/50 bg-card',
        className
      )}
    >
      {/* Background sparkline */}
      <div className="absolute inset-0 flex items-end opacity-30">
        <Sparkline
          data={data}
          width={200}
          height={60}
          color="auto"
          strokeWidth={1}
          showFill
          animated={false}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="text-muted-foreground mb-1 text-xs">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-foreground font-mono text-lg font-semibold">{value}</span>
          {change !== undefined && <TrendIndicator value={change} size="sm" />}
        </div>
      </div>
    </div>
  );
});
