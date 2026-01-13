import { cn } from '@shared/lib/utils';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  on,
  onCleanup,
  splitProps,
} from 'solid-js';

// ============================================
// Inline SVG Icons
// ============================================

/** Inline SVG arrow up icon */
function ArrowUpIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  );
}

/** Inline SVG arrow down icon */
function ArrowDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

/** Inline SVG minus icon */
function MinusIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

// ============================================
// Sparkline Helpers
// ============================================

/**
 * Color resolution map for sparkline strokes.
 */
const SPARKLINE_COLOR_MAP: Record<string, string> = {
  primary: 'var(--primary)',
  destructive: 'var(--destructive)',
  warning: 'var(--warning)',
  muted: 'var(--muted-foreground)',
};

/**
 * Resolve sparkline color based on color prop and trend direction.
 */
function resolveSparklineColor(
  color: 'primary' | 'destructive' | 'warning' | 'muted' | 'auto',
  values: number[]
): string {
  let resolvedColor = color;
  if (color === 'auto') {
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    resolvedColor = last >= first ? 'primary' : 'destructive';
  }
  return SPARKLINE_COLOR_MAP[resolvedColor] ?? SPARKLINE_COLOR_MAP['primary'] ?? 'var(--primary)';
}

interface Point {
  x: number;
  y: number;
}

/**
 * Generate SVG path string from points using linear or smooth curve.
 */
function generatePathFromPoints(points: Point[], curve: 'linear' | 'smooth'): string {
  const firstPoint = points[0];
  if (!firstPoint) return '';

  if (curve === 'smooth' && points.length > 2) {
    let pathD = `M ${String(firstPoint.x)} ${String(firstPoint.y)}`;
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
    return pathD;
  }

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${String(p.x)} ${String(p.y)}`).join(' ');
}

// ============================================
// Sparkline Component
// ============================================

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
  class?: string;
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
 */
function Sparkline(props: SparklineProps): JSX.Element {
  const [local] = splitProps(props, [
    'data',
    'width',
    'height',
    'class',
    'color',
    'showFill',
    'animated',
    'strokeWidth',
    'curve',
    'aria-label',
  ]);

  const width = () => local.width ?? 64;
  const height = () => local.height ?? 24;
  const color = () => local.color ?? 'primary';
  const showFill = () => local.showFill ?? true;
  const animated = () => local.animated ?? true;
  const strokeWidth = () => local.strokeWidth ?? 1.5;
  const curve = () => local.curve ?? 'smooth';
  const ariaLabel = () => local['aria-label'];

  // Use SolidJS unique ID for SSR-safe gradient IDs
  const gradientId = createUniqueId();

  const [mounted, setMounted] = createSignal(!animated());

  createEffect(
    on(
      () => animated(),
      (isAnimated) => {
        if (isAnimated) {
          const timer = setTimeout(() => {
            setMounted(true);
          }, 50);
          onCleanup(() => {
            clearTimeout(timer);
          });
        }
      }
    )
  );

  // Normalize data to numbers
  const values = createMemo(() => {
    return local.data.map((d) => (typeof d === 'number' ? d : d.value));
  });

  // Calculate path using extracted helpers
  const pathData = createMemo(() => {
    const vals = values();
    if (vals.length < 2) {
      return { linePath: '', areaPath: '', strokeColor: '' };
    }

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    const paddingX = 2;
    const paddingY = 2;
    const chartWidth = width() - paddingX * 2;
    const chartHeight = height() - paddingY * 2;

    const points: Point[] = vals.map((v, i) => ({
      x: paddingX + (i / (vals.length - 1)) * chartWidth,
      y: paddingY + chartHeight - ((v - min) / range) * chartHeight,
    }));

    const lastPoint = points[points.length - 1];
    if (!lastPoint) {
      return { linePath: '', areaPath: '', strokeColor: '' };
    }

    const stroke = resolveSparklineColor(color(), vals);
    const pathD = generatePathFromPoints(points, curve());
    const areaD = `${pathD} L ${String(lastPoint.x)} ${String(height() - paddingY)} L ${String(paddingX)} ${String(height() - paddingY)} Z`;

    return { linePath: pathD, areaPath: areaD, strokeColor: stroke };
  });

  // Generate accessible description from data trend
  const trendDescription = createMemo(() => {
    const label = ariaLabel();
    if (label) return label;
    const vals = values();
    if (vals.length < 2) return 'No trend data';
    const first = vals[0] ?? 0;
    const last = vals[vals.length - 1] ?? 0;
    const change = ((last - first) / (first || 1)) * 100;
    if (Math.abs(change) < 0.1) return 'Trend chart showing stable values';
    return change > 0
      ? `Trend chart showing ${change.toFixed(1)}% increase`
      : `Trend chart showing ${Math.abs(change).toFixed(1)}% decrease`;
  });

  // Calculate path length for animation
  const pathLength = () => width() * 2;

  return (
    <>
      {values().length < 2 ? (
        <div
          class={cn('bg-muted/50 flex items-center justify-center rounded', local.class)}
          style={{ width: `${width()}px`, height: `${height()}px` }}
          role="img"
          aria-label="Insufficient data for trend"
        >
          <MinusIcon class="text-muted-foreground h-3 w-3" />
        </div>
      ) : (
        <svg
          width={width()}
          height={height()}
          viewBox={`0 0 ${String(width())} ${String(height())}`}
          class={cn('overflow-visible', local.class)}
          role="img"
          aria-label={trendDescription()}
        >
          {showFill() && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color={pathData().strokeColor} stop-opacity={0.2} />
                <stop offset="100%" stop-color={pathData().strokeColor} stop-opacity={0} />
              </linearGradient>
            </defs>
          )}

          {/* Fill area */}
          {showFill() && (
            <path
              d={pathData().areaPath}
              fill={`url(#${gradientId})`}
              class={cn('transition-opacity duration-500', mounted() ? 'opacity-100' : 'opacity-0')}
            />
          )}

          {/* Line */}
          <path
            d={pathData().linePath}
            fill="none"
            stroke={pathData().strokeColor}
            stroke-width={strokeWidth()}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray={animated() ? String(pathLength()) : undefined}
            stroke-dashoffset={animated() ? (mounted() ? '0' : String(pathLength())) : undefined}
            class={animated() ? 'transition-[stroke-dashoffset] duration-700 ease-out' : undefined}
          />
        </svg>
      )}
    </>
  );
}

// ============================================
// SparklineWithValue Component
// ============================================

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

function SparklineWithValue(props: SparklineWithValueProps): JSX.Element {
  const [local, sparklineProps] = splitProps(props, ['value', 'change', 'label', 'valuePosition']);
  const valuePosition = () => local.valuePosition ?? 'right';

  const isPositive = () => {
    return typeof local.change === 'number'
      ? local.change >= 0
      : !String(local.change).startsWith('-');
  };

  return (
    <div class={cn('flex items-center gap-2', valuePosition() === 'left' && 'flex-row-reverse')}>
      <Sparkline {...sparklineProps} />
      <div class={cn('flex flex-col', valuePosition() === 'left' ? 'items-start' : 'items-end')}>
        {local.label && <span class="text-muted-foreground text-xs">{local.label}</span>}
        <span class="text-foreground font-mono text-sm font-medium">{local.value}</span>
        {local.change !== undefined && (
          <span
            class={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              isPositive() ? 'text-primary' : 'text-destructive'
            )}
          >
            {isPositive() ? <ArrowUpIcon class="h-3 w-3" /> : <ArrowDownIcon class="h-3 w-3" />}
            {typeof local.change === 'number'
              ? `${Math.abs(local.change).toFixed(2)}%`
              : local.change}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// MiniBarChart Component
// ============================================

/**
 * Mini bar chart for volume/distribution data
 */
interface MiniBarChartProps {
  data: number[];
  width?: number;
  height?: number;
  class?: string;
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
 */
function MiniBarChart(props: MiniBarChartProps): JSX.Element {
  const [local] = splitProps(props, [
    'data',
    'width',
    'height',
    'class',
    'color',
    'gap',
    'animated',
    'aria-label',
  ]);

  const width = () => local.width ?? 64;
  const height = () => local.height ?? 24;
  const color = () => local.color ?? 'primary';
  const gap = () => local.gap ?? 0.2;
  const animated = () => local.animated ?? true;
  const ariaLabel = () => local['aria-label'];

  const [mounted, setMounted] = createSignal(!animated());

  createEffect(
    on(
      () => animated(),
      (isAnimated) => {
        if (isAnimated) {
          const timer = setTimeout(() => {
            setMounted(true);
          }, 50);
          onCleanup(() => {
            clearTimeout(timer);
          });
        }
      }
    )
  );

  interface BarData {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
  }

  const bars = createMemo((): BarData[] => {
    const data = local.data;
    if (data.length === 0) return [];

    const max = Math.max(...data);
    if (max === 0) {
      return [];
    }

    const padding = 2;
    const chartWidth = width() - padding * 2;
    const chartHeight = height() - padding * 2;

    const barWidth = chartWidth / data.length;
    const barInnerWidth = barWidth * (1 - gap());

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
      fill: colorMap[color()] ?? 'var(--primary)',
    }));
  });

  // Generate accessible description from data
  const chartDescription = createMemo(() => {
    const label = ariaLabel();
    if (label) return label;
    const data = local.data;
    if (data.length === 0) return 'No data';
    const max = Math.max(...data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return `Bar chart with ${String(data.length)} bars, max value ${max.toFixed(1)}, average ${avg.toFixed(1)}`;
  });

  return (
    <>
      {local.data.length === 0 ? (
        <div
          class={cn('bg-muted/50 flex items-center justify-center rounded', local.class)}
          style={{ width: `${width()}px`, height: `${height()}px` }}
          role="img"
          aria-label="No data available"
        >
          <MinusIcon class="text-muted-foreground h-3 w-3" />
        </div>
      ) : (
        <svg
          width={width()}
          height={height()}
          viewBox={`0 0 ${String(width())} ${String(height())}`}
          class={local.class}
          role="img"
          aria-label={chartDescription()}
        >
          <For each={bars()}>
            {(bar, i) => (
              <rect
                x={bar.x}
                y={mounted() ? bar.y : height() - 2}
                width={bar.width}
                height={mounted() ? bar.height : 0}
                fill={bar.fill}
                rx={1}
                class="transition-all duration-500 ease-out"
                style={{ 'transition-delay': `${String(i() * 30)}ms` }}
              />
            )}
          </For>
        </svg>
      )}
    </>
  );
}

// ============================================
// TrendIndicator Component
// ============================================

/**
 * Trend indicator with arrow and change
 */
interface TrendIndicatorProps {
  value: number;
  class?: string;
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
 */
function TrendIndicator(props: TrendIndicatorProps): JSX.Element {
  const [local] = splitProps(props, [
    'value',
    'class',
    'isPercentage',
    'decimals',
    'size',
    'showNeutral',
  ]);

  const isPercentage = () => local.isPercentage ?? true;
  const decimals = () => local.decimals ?? 2;
  const size = () => local.size ?? 'md';
  const showNeutral = () => local.showNeutral ?? true;

  const isPositive = () => local.value > 0;
  const isNeutral = () => local.value === 0;

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

  return (
    <>
      {isNeutral() && showNeutral() ? (
        <span
          class={cn(
            'text-muted-foreground inline-flex items-center font-medium',
            sizeClasses[size()],
            local.class
          )}
        >
          <MinusIcon class={iconSizes[size()]} />
          {isPercentage() ? '0%' : '0'}
        </span>
      ) : (
        <span
          class={cn(
            'inline-flex items-center font-medium',
            isPositive() ? 'text-primary' : 'text-destructive',
            sizeClasses[size()],
            local.class
          )}
        >
          {isPositive() ? (
            <ArrowUpIcon class={iconSizes[size()]} />
          ) : (
            <ArrowDownIcon class={iconSizes[size()]} />
          )}
          {isPositive() ? '+' : ''}
          {local.value.toFixed(decimals())}
          {isPercentage() ? '%' : ''}
        </span>
      )}
    </>
  );
}

// ============================================
// SparklineStat Component
// ============================================

/**
 * Compact stat with sparkline background
 */
interface SparklineStatProps {
  label: string;
  value: string | number;
  data: number[];
  change?: number;
  class?: string;
}

/**
 * Compact stat with sparkline background
 */
function SparklineStat(props: SparklineStatProps): JSX.Element {
  const [local] = splitProps(props, ['label', 'value', 'data', 'change', 'class']);

  return (
    <div
      class={cn(
        'relative overflow-hidden rounded-lg border p-3',
        'border-border/50 bg-card',
        local.class
      )}
    >
      {/* Background sparkline */}
      <div class="absolute inset-0 flex items-end opacity-30">
        <Sparkline
          data={local.data}
          width={200}
          height={60}
          color="auto"
          strokeWidth={1}
          showFill
          animated={false}
        />
      </div>

      {/* Content */}
      <div class="relative z-10">
        <div class="text-muted-foreground mb-1 text-xs">{local.label}</div>
        <div class="flex items-baseline gap-2">
          <span class="text-foreground font-mono text-lg font-semibold">{local.value}</span>
          {local.change !== undefined && <TrendIndicator value={local.change} size="sm" />}
        </div>
      </div>
    </div>
  );
}

export {
  Sparkline,
  SparklineWithValue,
  MiniBarChart,
  TrendIndicator,
  SparklineStat,
  // Export icons for potential external use
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
};

export type {
  SparklineProps,
  SparklineWithValueProps,
  MiniBarChartProps,
  TrendIndicatorProps,
  SparklineStatProps,
};
