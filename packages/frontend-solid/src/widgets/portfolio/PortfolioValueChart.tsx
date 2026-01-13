import { useDashboardMarkets } from '@/features/markets';
import { usePortfolio } from '@/features/portfolio';
import { useAccount } from '@/features/wallet';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { ChartSkeleton } from '@shared/ui/Skeleton';
import { Sparkline } from '@shared/ui/Sparkline';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/ToggleGroup';
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

// ============================================
// Inline SVG Icons
// ============================================

function WalletIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
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

function CoinsIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format USD value with compact notation for large numbers
 */
function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) < 0.01) return value < 0 ? '-<$0.01' : '<$0.01';
  if (Math.abs(value) < 1000) return `$${value.toFixed(2)}`;
  if (Math.abs(value) < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (Math.abs(value) < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

/**
 * Format value with compact notation
 */
function formatCompact(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return '< 0.01';
  if (value < 1000) return value.toFixed(2);
  if (value < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

// ============================================
// Types
// ============================================

type TimeRange = '7d' | '30d' | '90d';

interface ChartDataPoint {
  date: string;
  displayDate: string;
  totalValueUsd: number;
  syBalanceUsd: number;
  ptBalanceUsd: number;
  ytBalanceUsd: number;
  lpBalanceUsd: number;
}

interface PortfolioValueChartProps {
  class?: string;
  height?: number;
  defaultRange?: TimeRange;
  showControls?: boolean;
}

// ============================================
// SVG Area Chart Component
// ============================================

interface AreaChartProps {
  data: ChartDataPoint[];
  height?: number;
}

function AreaChart(props: AreaChartProps): JSX.Element {
  const gradientId = createUniqueId();
  const width = 400;
  const height = () => props.height ?? 200;

  const pathData = createMemo(() => {
    const data = props.data;
    if (data.length < 2) return { linePath: '', areaPath: '' };

    const values = data.map((d) => d.totalValueUsd);
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const range = max - min || 1;

    const paddingX = 50;
    const paddingY = 20;
    const chartWidth = width - paddingX * 2;
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
    const values = props.data.map((d) => d.totalValueUsd);
    if (values.length === 0) return [];
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const step = (max - min) / 4;
    return [max, max - step, max - step * 2, max - step * 3, min].map((v) => formatUsdCompact(v));
  });

  // Generate X-axis labels
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
      viewBox={`0 0 ${width} ${height()}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Portfolio value chart"
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
            x1="50"
            y1={20 + ((height() - 40) / 4) * i}
            x2={width - 50}
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
            x="45"
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
            x={50 + (i() * (width - 100)) / Math.max(xLabels().length - 1, 1)}
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
// PortfolioValueChart Component
// ============================================

/**
 * Line chart showing portfolio value over time.
 * Uses current on-chain positions with generated historical visualization.
 * Ported from React to SolidJS.
 */
export function PortfolioValueChart(props: PortfolioValueChartProps): JSX.Element {
  const height = () => props.height ?? 300;
  const showControls = () => props.showControls ?? true;
  const [range, setRange] = createSignal<TimeRange>(props.defaultRange ?? '30d');
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  const { address } = useAccount();
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { summary, isLoading, isError } = usePortfolio(markets);

  // Calculate days from range
  const days = createMemo(() => {
    switch (range()) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 30;
    }
  });

  // Simplified price assumption (1 SY = $1 for demo purposes)
  // In production, this would use a price oracle
  const avgPrice = 1;

  // Generate chart data from current portfolio state
  const chartData = createMemo((): ChartDataPoint[] => {
    const portfolioSummary = summary();
    if (portfolioSummary.marketCount === 0) return [];

    const syBalance = Number(fromWad(portfolioSummary.totalSyBalance));
    const ptBalance = Number(fromWad(portfolioSummary.totalPtBalance));
    const ytBalance = Number(fromWad(portfolioSummary.totalYtBalance));
    const lpBalance = Number(fromWad(portfolioSummary.totalLpBalance));

    // Current values
    const syBalanceUsd = syBalance * avgPrice;
    const ptBalanceUsd = ptBalance * avgPrice;
    const ytBalanceUsd = ytBalance * avgPrice * 0.1; // YT is yield component only
    const lpBalanceUsd = lpBalance * avgPrice * 2; // LP = share of SY + PT pool
    const totalValueUsd = syBalanceUsd + ptBalanceUsd + ytBalanceUsd + lpBalanceUsd;

    if (totalValueUsd === 0) return [];

    // Generate historical data for visualization
    const today = new Date();
    const numDays = days();
    const data: ChartDataPoint[] = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const progress = (numDays - i) / numDays;
      const variation = i === 0 ? 1 : 0.85 + Math.random() * 0.2 * progress;

      const displayDate = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      data.push({
        date: date.toISOString().split('T')[0] ?? '',
        displayDate,
        totalValueUsd: totalValueUsd * variation,
        syBalanceUsd: syBalanceUsd * variation,
        ptBalanceUsd: ptBalanceUsd * variation,
        ytBalanceUsd: ytBalanceUsd * variation,
        lpBalanceUsd: lpBalanceUsd * variation,
      });
    }

    return data;
  });

  // Calculate stats
  const stats = createMemo(() => {
    const data = chartData();
    const currentValue = data.length > 0 ? (data[data.length - 1]?.totalValueUsd ?? 0) : 0;
    const startValue = data.length > 0 ? (data[0]?.totalValueUsd ?? 0) : 0;
    const unrealized = currentValue - startValue;

    return {
      currentValue,
      unrealized,
      portfolioSummary: summary(),
    };
  });

  // Not connected state
  if (!address()) {
    return (
      <Card class={props.class}>
        <CardHeader>
          <CardTitle>Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent class="py-8 text-center">
          <WalletIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">Connect wallet to view portfolio history</p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading() || marketsLoading()) {
    return <ChartSkeleton class={props.class} height={height()} chartType="area" showHeader showFooter />;
  }

  // Error state
  if (isError()) {
    return (
      <Card class={cn('border-destructive/50', props.class)}>
        <CardContent class="py-8 text-center">
          <p class="text-destructive text-sm">Failed to load portfolio history</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData().length === 0) {
    return (
      <Card class={props.class}>
        <CardHeader>
          <CardTitle>Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent class="py-8 text-center">
          <CoinsIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">No portfolio history available</p>
          <p class="text-muted-foreground mt-1 text-xs">
            Start trading to see your portfolio value over time
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      class={cn(
        'translate-y-2 opacity-0',
        mounted() && 'translate-y-0 opacity-100',
        'transition-all duration-500',
        props.class
      )}
    >
      <CardHeader class="flex flex-row items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <WalletIcon class="text-primary h-4 w-4" />
            Portfolio Value
          </CardTitle>
          <div class="text-muted-foreground flex gap-4 text-sm">
            <span>
              Current:{' '}
              <span class="text-foreground font-mono font-medium">
                {formatUsdCompact(stats().currentValue)}
              </span>
            </span>
            <span>
              P&L:{' '}
              <span
                class={cn(
                  'font-mono font-medium',
                  stats().unrealized >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {stats().unrealized >= 0 ? '+' : ''}
                {formatUsdCompact(stats().unrealized)}
              </span>
            </span>
          </div>
        </div>
        <Show when={showControls()}>
          <ToggleGroup variant="outline">
            <ToggleGroupItem pressed={range() === '7d'} onClick={() => setRange('7d')}>
              7D
            </ToggleGroupItem>
            <ToggleGroupItem pressed={range() === '30d'} onClick={() => setRange('30d')}>
              30D
            </ToggleGroupItem>
            <ToggleGroupItem pressed={range() === '90d'} onClick={() => setRange('90d')}>
              90D
            </ToggleGroupItem>
          </ToggleGroup>
        </Show>
      </CardHeader>
      <CardContent>
        <AreaChart data={chartData()} height={height()} />

        {/* Summary stats */}
        <div class="border-border/50 mt-4 grid grid-cols-4 gap-4 border-t pt-4">
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <LayersIcon class="h-3 w-3" />
              SY
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(Number(fromWad(stats().portfolioSummary.totalSyBalance)))}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <CircleDotIcon class="h-3 w-3" />
              PT
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(Number(fromWad(stats().portfolioSummary.totalPtBalance)))}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <TrendingUpIcon class="h-3 w-3" />
              YT
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(Number(fromWad(stats().portfolioSummary.totalYtBalance)))}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <CoinsIcon class="h-3 w-3" />
              LP
            </div>
            <div class="text-foreground font-mono text-sm font-semibold">
              {formatCompact(Number(fromWad(stats().portfolioSummary.totalLpBalance)))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact sparkline version for embedding in other components
 */
interface PortfolioSparklineProps {
  class?: string;
  height?: number;
  days?: number;
}

export function PortfolioSparkline(props: PortfolioSparklineProps): JSX.Element {
  const height = () => props.height ?? 60;
  const days = () => props.days ?? 7;

  const { address } = useAccount();
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { summary, isLoading } = usePortfolio(markets);

  const sparklineData = createMemo(() => {
    const portfolioSummary = summary();
    if (portfolioSummary.marketCount === 0) return [];

    const totalValue =
      Number(fromWad(portfolioSummary.totalSyBalance)) +
      Number(fromWad(portfolioSummary.totalPtBalance)) +
      Number(fromWad(portfolioSummary.totalYtBalance)) * 0.1 +
      Number(fromWad(portfolioSummary.totalLpBalance)) * 2;

    if (totalValue === 0) return [];

    // Generate simple trend data for sparkline
    return Array.from({ length: days() }, (_, i) => {
      const progress = (i + 1) / days();
      return totalValue * (0.85 + Math.random() * 0.2 * progress);
    });
  });

  return (
    <Show when={address() && !isLoading() && !marketsLoading() && sparklineData().length > 0}>
      <Sparkline
        data={sparklineData()}
        width={100}
        height={height()}
        color="auto"
        showFill
        animated
        {...(props.class ? { class: props.class } : {})}
      />
    </Show>
  );
}
