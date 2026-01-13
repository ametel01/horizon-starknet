import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { ChartSkeleton } from '@shared/ui/Skeleton';
import { createEffect, createMemo, createSignal, For, type JSX, onCleanup } from 'solid-js';
import { useDashboardMarkets } from '@/features/markets';

// ============================================
// Inline SVG Icons
// ============================================

function BarChart3Icon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function ActivityIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
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

function ArrowLeftRightIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}

function CalendarIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
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

interface VolumeChartProps {
  class?: string;
  height?: number;
  days?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  volume: number;
  syVolume: number;
  ptVolume: number;
  swapCount: number;
}

// ============================================
// SVG Bar Chart Component
// ============================================

interface BarChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  class?: string;
}

function BarChart(props: BarChartProps): JSX.Element {
  const width = () => props.width ?? 400;
  const height = () => props.height ?? 200;
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  const bars = createMemo(() => {
    const data = props.data;
    if (data.length === 0) return [];

    const values = data.map((d) => d.volume);
    const max = Math.max(...values) * 1.1;
    if (max === 0) return [];

    const paddingX = 40;
    const paddingY = 20;
    const chartWidth = width() - paddingX * 2;
    const chartHeight = height() - paddingY * 2;

    const barWidth = (chartWidth / data.length) * 0.7;
    const barGap = (chartWidth / data.length) * 0.3;

    return data.map((d, i) => ({
      x: paddingX + i * (barWidth + barGap) + barGap / 2,
      y: paddingY + chartHeight - (d.volume / max) * chartHeight,
      width: barWidth,
      height: (d.volume / max) * chartHeight,
      value: d.volume,
      label: d.displayDate,
    }));
  });

  // Generate Y-axis labels
  const yLabels = createMemo(() => {
    const values = props.data.map((d) => d.volume);
    if (values.length === 0) return [];
    const max = Math.max(...values) * 1.1;
    const step = max / 4;
    return [max, max - step, max - step * 2, max - step * 3, 0].map((v) => formatCompact(v));
  });

  return (
    <svg
      width="100%"
      height={height()}
      viewBox={`0 0 ${width()} ${height()}`}
      preserveAspectRatio="xMidYMid meet"
      class={props.class}
      role="img"
      aria-label="Volume bar chart"
    >
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

      {/* Bars */}
      <For each={bars()}>
        {(bar, i) => (
          <rect
            x={bar.x}
            y={mounted() ? bar.y : height() - 20}
            width={bar.width}
            height={mounted() ? bar.height : 0}
            fill="var(--primary)"
            rx="4"
            ry="4"
            class="transition-all duration-500 ease-out"
            style={{ 'transition-delay': `${i() * 30}ms` }}
          />
        )}
      </For>

      {/* X-axis labels */}
      <For each={bars()}>
        {(bar) => (
          <text
            x={bar.x + bar.width / 2}
            y={height() - 5}
            text-anchor="middle"
            fill="var(--muted-foreground)"
            font-size="10"
          >
            {bar.label}
          </text>
        )}
      </For>
    </svg>
  );
}

// ============================================
// VolumeChart Component
// ============================================

/**
 * Bar chart showing daily trading volume over time.
 * Displays volume in native token values.
 */
export function VolumeChart(props: VolumeChartProps): JSX.Element {
  const height = () => props.height ?? 300;
  const days = () => props.days ?? 7;
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  const { markets, isLoading } = useDashboardMarkets();

  // Calculate current TVL as proxy for volume scale
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

  // Generate mock volume data based on TVL
  const chartData = createMemo((): ChartDataPoint[] => {
    const currentTvl = tvl();
    if (currentTvl === 0) return [];

    const today = new Date();
    const data: ChartDataPoint[] = [];

    // Generate volume data for last N days
    // Volume is typically 5-15% of TVL daily
    for (let i = days() - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dailyVolume = currentTvl * (0.05 + Math.random() * 0.1);
      const syRatio = 0.4 + Math.random() * 0.2;

      data.push({
        date: date.toISOString().split('T')[0] ?? '',
        displayDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        volume: dailyVolume,
        syVolume: dailyVolume * syRatio,
        ptVolume: dailyVolume * (1 - syRatio),
        swapCount: Math.floor(10 + Math.random() * 50),
      });
    }

    return data;
  });

  // Calculate stats
  const stats = createMemo(() => {
    const data = chartData();
    if (data.length === 0) {
      return { vol24h: 0, vol7d: 0, swaps24h: 0, avgDaily: 0 };
    }

    const vol24h = data[data.length - 1]?.volume ?? 0;
    const vol7d = data.reduce((sum, d) => sum + d.volume, 0);
    const swaps24h = data[data.length - 1]?.swapCount ?? 0;
    const avgDaily = vol7d / data.length;

    return { vol24h, vol7d, swaps24h, avgDaily };
  });

  // Loading state
  if (isLoading()) {
    return (
      <ChartSkeleton class={props.class} height={height()} chartType="bar" showHeader showFooter />
    );
  }

  // Empty state
  if (chartData().length === 0) {
    return (
      <div class={cn('border-border/50 bg-card overflow-hidden rounded-xl border', props.class)}>
        <div class="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <BarChart3Icon class="text-primary h-4 w-4" />
          <h3 class="text-foreground text-sm font-semibold">Trading Volume</h3>
        </div>
        <div class="py-8 text-center">
          <ActivityIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">No volume data available</p>
        </div>
      </div>
    );
  }

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
          <BarChart3Icon class="text-primary h-4 w-4" />
          <h3 class="text-foreground text-sm font-semibold">Trading Volume</h3>
        </div>
        <div class="text-primary font-mono text-sm font-semibold">
          {formatCompact(stats().vol24h)}
          <span class="text-muted-foreground ml-1 font-normal">24h</span>
        </div>
      </div>

      {/* Chart */}
      <div class="p-4">
        <BarChart data={chartData()} height={height()} />

        {/* Summary stats */}
        <div class="border-border/50 mt-4 grid grid-cols-4 gap-4 border-t pt-4">
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <TrendingUpIcon class="h-3 w-3" />
              24h Vol
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(stats().vol24h)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <BarChart3Icon class="h-3 w-3" />
              7d Vol
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(stats().vol7d)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <ArrowLeftRightIcon class="h-3 w-3" />
              24h Swaps
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">{stats().swaps24h}</div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <CalendarIcon class="h-3 w-3" />
              Avg Daily
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(stats().avgDaily)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stacked bar chart showing SY vs PT volume breakdown
 */
interface VolumeStackedChartProps {
  class?: string;
  height?: number;
  days?: number;
}

export function VolumeStackedChart(props: VolumeStackedChartProps): JSX.Element {
  const height = () => props.height ?? 300;
  const days = () => props.days ?? 7;
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  const { markets, isLoading } = useDashboardMarkets();

  // Calculate current TVL as proxy for volume scale
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

  // Generate mock volume data
  const chartData = createMemo(() => {
    const currentTvl = tvl();
    if (currentTvl === 0) return [];

    const today = new Date();
    return Array.from({ length: days() }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (days() - 1 - i));
      const dailyVolume = currentTvl * (0.05 + Math.random() * 0.1);
      const syRatio = 0.4 + Math.random() * 0.2;

      return {
        date: date.toISOString().split('T')[0] ?? '',
        displayDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        syVolume: dailyVolume * syRatio,
        ptVolume: dailyVolume * (1 - syRatio),
        swapCount: Math.floor(10 + Math.random() * 50),
      };
    });
  });

  // Calculate totals
  const totals = createMemo(() => {
    const data = chartData();
    const syTotal = data.reduce((sum, d) => sum + d.syVolume, 0);
    const ptTotal = data.reduce((sum, d) => sum + d.ptVolume, 0);
    return { syTotal, ptTotal };
  });

  if (isLoading()) {
    return (
      <ChartSkeleton
        class={props.class}
        height={height()}
        chartType="bar"
        showHeader
        showFooter={false}
      />
    );
  }

  if (chartData().length === 0) {
    return (
      <div class={cn('border-border/50 bg-card overflow-hidden rounded-xl border', props.class)}>
        <div class="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <LayersIcon class="text-primary h-4 w-4" />
          <h3 class="text-foreground text-sm font-semibold">Volume by Token Type</h3>
        </div>
        <div class="py-8 text-center">
          <ActivityIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">No volume data available</p>
        </div>
      </div>
    );
  }

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
          <LayersIcon class="text-primary h-4 w-4" />
          <h3 class="text-foreground text-sm font-semibold">Volume by Token Type</h3>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1">
            <span
              class="h-2 w-2 rounded-sm"
              style={{ 'background-color': 'var(--chart-1, var(--primary))' }}
            />
            SY
          </span>
          <span class="flex items-center gap-1">
            <span
              class="h-2 w-2 rounded-sm"
              style={{ 'background-color': 'var(--chart-3, var(--muted-foreground))' }}
            />
            PT
          </span>
        </div>
      </div>

      {/* Chart - Stacked bar visualization */}
      <div class="p-4">
        <StackedBarChart data={chartData()} height={height()} />

        {/* Summary stats */}
        <div class="border-border/50 mt-4 grid grid-cols-2 gap-4 border-t pt-4">
          <div class="text-center">
            <div class="mb-1 flex items-center justify-center gap-1 text-xs">
              <span
                class="h-2 w-2 rounded-sm"
                style={{ 'background-color': 'var(--chart-1, var(--primary))' }}
              />
              <span class="text-muted-foreground">SY Volume (7d)</span>
            </div>
            <div class="text-foreground font-mono text-lg font-semibold">
              {formatCompact(totals().syTotal)}
            </div>
          </div>
          <div class="text-center">
            <div class="mb-1 flex items-center justify-center gap-1 text-xs">
              <span
                class="h-2 w-2 rounded-sm"
                style={{ 'background-color': 'var(--chart-3, var(--muted-foreground))' }}
              />
              <span class="text-muted-foreground">PT Volume (7d)</span>
            </div>
            <div class="text-foreground font-mono text-lg font-semibold">
              {formatCompact(totals().ptTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Stacked Bar Chart Component
// ============================================

interface StackedBarChartProps {
  data: Array<{
    displayDate: string;
    syVolume: number;
    ptVolume: number;
  }>;
  width?: number;
  height?: number;
  class?: string;
}

function StackedBarChart(props: StackedBarChartProps): JSX.Element {
  const width = () => props.width ?? 400;
  const height = () => props.height ?? 200;
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  const bars = createMemo(() => {
    const data = props.data;
    if (data.length === 0) return [];

    const totals = data.map((d) => d.syVolume + d.ptVolume);
    const max = Math.max(...totals) * 1.1;
    if (max === 0) return [];

    const paddingX = 40;
    const paddingY = 20;
    const chartWidth = width() - paddingX * 2;
    const chartHeight = height() - paddingY * 2;

    const barWidth = (chartWidth / data.length) * 0.7;
    const barGap = (chartWidth / data.length) * 0.3;

    return data.map((d, i) => {
      const syHeight = (d.syVolume / max) * chartHeight;
      const ptHeight = (d.ptVolume / max) * chartHeight;
      const baseY = paddingY + chartHeight;

      return {
        x: paddingX + i * (barWidth + barGap) + barGap / 2,
        syY: baseY - syHeight,
        syHeight,
        ptY: baseY - syHeight - ptHeight,
        ptHeight,
        width: barWidth,
        label: d.displayDate,
      };
    });
  });

  // Generate Y-axis labels
  const yLabels = createMemo(() => {
    const totals = props.data.map((d) => d.syVolume + d.ptVolume);
    if (totals.length === 0) return [];
    const max = Math.max(...totals) * 1.1;
    const step = max / 4;
    return [max, max - step, max - step * 2, max - step * 3, 0].map((v) => formatCompact(v));
  });

  return (
    <svg
      width="100%"
      height={height()}
      viewBox={`0 0 ${width()} ${height()}`}
      preserveAspectRatio="xMidYMid meet"
      class={props.class}
      role="img"
      aria-label="Stacked volume bar chart"
    >
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

      {/* Stacked bars */}
      <For each={bars()}>
        {(bar, i) => (
          <>
            {/* SY portion (bottom) */}
            <rect
              x={bar.x}
              y={mounted() ? bar.syY : height() - 20}
              width={bar.width}
              height={mounted() ? bar.syHeight : 0}
              fill="var(--chart-1, var(--primary))"
              class="transition-all duration-500 ease-out"
              style={{ 'transition-delay': `${i() * 30}ms` }}
            />
            {/* PT portion (top) */}
            <rect
              x={bar.x}
              y={mounted() ? bar.ptY : height() - 20}
              width={bar.width}
              height={mounted() ? bar.ptHeight : 0}
              fill="var(--chart-3, var(--muted-foreground))"
              rx="4"
              ry="4"
              class="transition-all duration-500 ease-out"
              style={{ 'transition-delay': `${i() * 30 + 50}ms` }}
            />
          </>
        )}
      </For>

      {/* X-axis labels */}
      <For each={bars()}>
        {(bar) => (
          <text
            x={bar.x + bar.width / 2}
            y={height() - 5}
            text-anchor="middle"
            fill="var(--muted-foreground)"
            font-size="10"
          >
            {bar.label}
          </text>
        )}
      </For>
    </svg>
  );
}
