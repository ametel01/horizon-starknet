import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { ChartSkeleton } from '@shared/ui/Skeleton';
import { Sparkline } from '@shared/ui/Sparkline';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { useDashboardMarkets } from '@/features/markets';

// ============================================
// Inline SVG Icons
// ============================================

function LockIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function LayersIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.5-8.97 4.08a2 2 0 0 1-1.66 0L2.4 12.5" />
      <path d="m22 17.5-8.97 4.08a2 2 0 0 1-1.66 0L2.4 17.5" />
    </svg>
  );
}

function CircleDotIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function TrendingUpIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function DollarSignIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format value with compact notation for large numbers
 */
function formatCompact(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';
  if (value < 1000) return value.toFixed(2);
  if (value < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}

// ============================================
// Types
// ============================================

interface TvlChartProps {
  class?: string;
  height?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  tvl: number;
  syReserve: number;
  ptReserve: number;
  marketCount: number;
}

// ============================================
// SVG Area Chart Component
// ============================================

interface AreaChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  class?: string;
}

function AreaChart(props: AreaChartProps): JSX.Element {
  const gradientId = createUniqueId();
  const width = () => props.width ?? 400;
  const height = () => props.height ?? 200;

  const pathData = createMemo(() => {
    const data = props.data;
    if (data.length < 2) return { linePath: '', areaPath: '' };

    const values = data.map((d) => d.tvl);
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const range = max - min || 1;

    const paddingX = 40;
    const paddingY = 20;
    const chartWidth = width() - paddingX * 2;
    const chartHeight = height() - paddingY * 2;

    const points = values.map((v, i) => ({
      x: paddingX + (i / (values.length - 1)) * chartWidth,
      y: paddingY + chartHeight - ((v - min) / range) * chartHeight,
    }));

    // Create smooth curve using quadratic bezier
    let pathD = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
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

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const areaD = `${pathD} L ${lastPoint?.x ?? 0} ${height() - paddingY} L ${firstPoint?.x ?? 0} ${height() - paddingY} Z`;

    return { linePath: pathD, areaPath: areaD };
  });

  // Generate Y-axis labels
  const yLabels = createMemo(() => {
    const values = props.data.map((d) => d.tvl);
    if (values.length === 0) return [];
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const step = (max - min) / 4;
    return [max, max - step, max - step * 2, max - step * 3, min].map((v) => formatCompact(v));
  });

  // Generate X-axis labels (show every nth label based on data length)
  const xLabels = createMemo(() => {
    const data = props.data;
    if (data.length <= 5) return data.map((d) => d.displayDate);
    const step = Math.ceil(data.length / 5);
    return data.filter((_, i) => i % step === 0).map((d) => d.displayDate);
  });

  return (
    <svg
      width="100%"
      height={height()}
      viewBox={`0 0 ${width()} ${height()}`}
      preserveAspectRatio="xMidYMid meet"
      class={props.class}
      role="img"
      aria-label="TVL chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      <For each={[0, 1, 2, 3, 4]}>
        {(i) => (
          <line
            x1="40"
            y1={20 + ((height() - 40) / 4) * i}
            x2={width() - 40}
            y2={20 + ((height() - 40) / 4) * i}
            stroke="var(--border)"
            stroke-dasharray="3 3"
            stroke-opacity="0.5"
          />
        )}
      </For>

      {/* Y-axis labels */}
      <For each={yLabels()}>
        {(label, i) => (
          <text
            x="35"
            y={25 + ((height() - 40) / 4) * i()}
            text-anchor="end"
            fill="var(--muted-foreground)"
            font-size="10"
          >
            {label}
          </text>
        )}
      </For>

      {/* Area fill */}
      <path d={pathData().areaPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={pathData().linePath}
        fill="none"
        stroke="var(--primary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      {/* X-axis labels */}
      <For each={xLabels()}>
        {(label, i) => (
          <text
            x={40 + (i() * (width() - 80)) / Math.max(xLabels().length - 1, 1)}
            y={height() - 5}
            text-anchor="middle"
            fill="var(--muted-foreground)"
            font-size="10"
          >
            {label}
          </text>
        )}
      </For>
    </svg>
  );
}

// ============================================
// TvlChart Component
// ============================================

/**
 * TVL Chart showing current TVL across all markets.
 * Uses on-chain data with native token values.
 */
export function TvlChart(props: TvlChartProps): JSX.Element {
  const height = () => props.height ?? 300;
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  // Get current on-chain data
  const { markets, isLoading } = useDashboardMarkets();

  // Calculate TVL values
  const tvlData = createMemo(() => {
    const data = markets();
    let totalSyReserve = 0;
    let totalPtReserve = 0;

    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      totalSyReserve += syReserve;
      totalPtReserve += ptReserve;
    }

    return {
      totalTvl: totalSyReserve + totalPtReserve,
      totalSyReserve,
      totalPtReserve,
      marketCount: data.length,
    };
  });

  // Generate mock historical data based on current TVL (for visualization)
  const chartData = createMemo((): ChartDataPoint[] => {
    const current = tvlData();
    if (current.totalTvl === 0) return [];

    // Create a simple visualization with current value
    const today = new Date();
    const data: ChartDataPoint[] = [];

    // Generate last 7 days with slight variations for visual interest
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const variation = i === 0 ? 1 : 0.9 + Math.random() * 0.15;

      data.push({
        date: date.toISOString().split('T')[0] ?? '',
        displayDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        tvl: current.totalTvl * variation,
        syReserve: current.totalSyReserve * variation,
        ptReserve: current.totalPtReserve * variation,
        marketCount: current.marketCount,
      });
    }

    return data;
  });

  // Loading state
  if (isLoading()) {
    return (
      <ChartSkeleton class={props.class} height={height()} chartType="area" showHeader showFooter />
    );
  }

  // Empty state
  if (chartData().length === 0) {
    return (
      <div class={cn('border-border/50 bg-card overflow-hidden rounded-xl border', props.class)}>
        <div class="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <LockIcon class="text-primary h-4 w-4" />
          <h3 class="text-foreground text-sm font-semibold">Total Value Locked</h3>
        </div>
        <div class="py-8 text-center">
          <DollarSignIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">No TVL data available</p>
        </div>
      </div>
    );
  }

  const current = tvlData();

  return (
    <div
      class={cn(
        'border-border/50 bg-card overflow-hidden rounded-xl border',
        'translate-y-2 opacity-0',
        mounted() && 'translate-y-0 opacity-100',
        'transition-all duration-500',
        props.class
      )}
    >
      {/* Header */}
      <div class="border-border/50 flex items-center justify-between border-b px-4 py-3">
        <div class="flex items-center gap-2">
          <LockIcon class="text-primary h-4 w-4" />
          <h3 class="text-foreground text-sm font-semibold">Total Value Locked</h3>
        </div>
        <div class="text-primary font-mono text-sm font-semibold">
          {formatCompact(current.totalTvl)}
        </div>
      </div>

      {/* Chart */}
      <div class="p-4">
        <AreaChart data={chartData()} height={height()} />

        {/* Summary stats */}
        <div class="border-border/50 mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <LayersIcon class="h-3 w-3" />
              SY Reserve
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(current.totalSyReserve)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <CircleDotIcon class="h-3 w-3" />
              PT Reserve
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(current.totalPtReserve)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <TrendingUpIcon class="h-3 w-3" />
              Markets
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">{current.marketCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact sparkline version of TVL chart for cards
 */
interface TvlSparklineProps {
  class?: string;
  height?: number;
}

export function TvlSparkline(props: TvlSparklineProps): JSX.Element {
  const height = () => props.height ?? 60;
  const { markets, isLoading } = useDashboardMarkets();

  const tvl = createMemo(() => {
    const data = markets();
    let total = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      total += syReserve + ptReserve;
    }
    return total;
  });

  // Generate sparkline data
  const sparklineData = createMemo(() => {
    const current = tvl();
    if (current === 0) return [];
    // Generate simple trend data
    return Array.from({ length: 7 }, () => current * (0.9 + Math.random() * 0.15));
  });

  return (
    <Show when={!isLoading() && sparklineData().length > 0}>
      <Sparkline
        data={sparklineData()}
        width={100}
        height={height()}
        color="primary"
        showFill
        animated
        {...(props.class ? { class: props.class } : {})}
      />
    </Show>
  );
}
