import { useDashboardMarkets } from '@/features/markets';
import { type MarketPosition, useActivePositions } from '@/features/portfolio';
import { useAccount } from '@/features/wallet';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { ChartSkeleton } from '@shared/ui/Skeleton';
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
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

function ClockIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
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

interface ChartDataPoint {
  date: string;
  displayDate: string;
  ptBalance: number;
  ytBalance: number;
  cumulativeYield: number;
}

interface PositionPnlTimelineProps {
  class?: string;
  height?: number;
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

    const values = data.map((d) => d.cumulativeYield);
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const range = max - min || 1;

    const paddingX = 40;
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
    const values = props.data.map((d) => d.cumulativeYield);
    if (values.length === 0) return [];
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const step = (max - min) / 4;
    return [max, max - step, max - step * 2, max - step * 3, min].map((v) => formatCompact(v));
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
      aria-label="Position P&L timeline chart"
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
            x2={width - 40}
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

      {/* Reference line at 0 */}
      <line
        x1="40"
        y1={height() / 2}
        x2={width - 40}
        y2={height() / 2}
        stroke="var(--border)"
        stroke-dasharray="3 3"
      />

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
            x={40 + (i() * (width - 80)) / Math.max(xLabels().length - 1, 1)}
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
// Position Row Component
// ============================================

interface PositionRowProps {
  position: MarketPosition;
  ytSymbol: string;
}

function PositionRow(props: PositionRowProps): JSX.Element {
  const ptBalance = () => Number(fromWad(props.position.ptBalance));
  const ytBalance = () => Number(fromWad(props.position.ytBalance));
  const yieldClaimed = () => Number(fromWad(props.position.claimableYield));

  const daysLeft = createMemo(() => {
    const expiry = props.position.market.expiry;
    const now = Date.now() / 1000;
    return Math.round((expiry - now) / 86400);
  });

  const isExpired = () => props.position.market.isExpired;

  return (
    <div class="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div class="flex items-center gap-3">
        <div class="flex flex-col">
          <span class="text-foreground text-sm font-medium">{props.ytSymbol}</span>
          <span class="text-muted-foreground text-xs">
            {isExpired() ? 'Expired' : `${daysLeft()}d left`}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-6 text-right">
        <div class="flex flex-col">
          <span class="text-muted-foreground text-xs">PT / YT</span>
          <span class="text-foreground font-mono text-sm">
            {ptBalance().toFixed(2)} / {ytBalance().toFixed(2)}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-muted-foreground text-xs">Claimable</span>
          <span class="text-primary text-sm font-medium">{yieldClaimed().toFixed(4)} SY</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PositionPnlTimeline Component
// ============================================

/**
 * Position P&L Timeline widget
 *
 * Shows historical P&L timeline with position balances and yield earned over time.
 * Ported from React to SolidJS.
 */
export function PositionPnlTimeline(props: PositionPnlTimelineProps): JSX.Element {
  const height = () => props.height ?? 300;
  const [activeTab, setActiveTab] = createSignal('timeline');
  const [mounted, setMounted] = createSignal(false);

  createEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    onCleanup(() => clearTimeout(timer));
  });

  const { address } = useAccount();
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();

  // Get positions with real on-chain data
  const { positions, totalClaimableYield, isLoading, isError } = useActivePositions(markets);

  // Build YT to symbol map
  const ytSymbolMap = createMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets()) {
      const symbol = market.metadata?.yieldTokenSymbol ?? 'Token';
      map.set(market.ytAddress.toLowerCase(), `PT/YT-${symbol}`);
    }
    return map;
  });

  // Generate timeline data from current positions (simplified - real impl would use historical data)
  const chartData = createMemo((): ChartDataPoint[] => {
    const pos = positions();
    if (pos.length === 0) return [];

    // Generate mock historical data for visualization
    const totalYield = Number(fromWad(totalClaimableYield()));
    const today = new Date();
    const data: ChartDataPoint[] = [];

    // Create last 30 days of data with gradual yield accumulation
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const progress = (30 - i) / 30;

      // Calculate cumulative totals at this point
      let ptTotal = 0;
      let ytTotal = 0;
      for (const p of pos) {
        ptTotal += Number(fromWad(p.ptBalance));
        ytTotal += Number(fromWad(p.ytBalance));
      }

      data.push({
        date: date.toISOString().split('T')[0] ?? '',
        displayDate: formatDate(date.toISOString()),
        ptBalance: ptTotal * (0.9 + progress * 0.1), // Slight variation
        ytBalance: ytTotal * (0.9 + progress * 0.1),
        cumulativeYield: totalYield * progress,
      });
    }

    return data;
  });

  // Calculate summary stats
  const summary = createMemo(() => {
    const pos = positions();
    let totalPtMinted = 0;
    let yieldClaimCount = 0;

    for (const p of pos) {
      totalPtMinted += Number(fromWad(p.ptBalance));
      // In a real impl, this would come from historical data
      yieldClaimCount += p.claimableYield > 0n ? 1 : 0;
    }

    return {
      totalPositions: pos.length,
      totalPtMinted,
      yieldClaimCount,
      totalYield: Number(fromWad(totalClaimableYield())),
    };
  });

  // Not connected state
  if (!address()) {
    return (
      <Card class={props.class}>
        <CardHeader>
          <CardTitle>Position P&L</CardTitle>
        </CardHeader>
        <CardContent class="py-8 text-center">
          <TrendingUpIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">Connect wallet to view positions</p>
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
          <p class="text-destructive text-sm">Failed to load P&L timeline</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (positions().length === 0) {
    return (
      <Card class={props.class}>
        <CardHeader>
          <CardTitle>Position P&L</CardTitle>
        </CardHeader>
        <CardContent class="py-8 text-center">
          <CoinsIcon class="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p class="text-muted-foreground text-sm">No positions found</p>
          <p class="text-muted-foreground mt-1 text-xs">
            Mint PT/YT tokens to see your positions here
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
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="flex items-center gap-2">
              <TrendingUpIcon class="text-primary h-4 w-4" />
              Position P&L Timeline
            </CardTitle>
            <p class="text-muted-foreground mt-1 text-sm">
              {summary().totalPositions} active position{summary().totalPositions !== 1 ? 's' : ''}
            </p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-muted-foreground text-xs">Total Claimable</div>
              <div class="text-primary font-mono font-medium">
                {summary().totalYield.toFixed(4)} SY
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TabsRoot value={activeTab()} onChange={setActiveTab}>
          <TabsList class="mb-4">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <Show
              when={chartData().length > 0}
              fallback={
                <div class="flex items-center justify-center" style={{ height: `${height()}px` }}>
                  <p class="text-muted-foreground text-sm">No timeline data available</p>
                </div>
              }
            >
              <AreaChart data={chartData()} height={height()} />
            </Show>
          </TabsContent>

          <TabsContent value="positions">
            <div class="max-h-[300px] overflow-y-auto">
              <For each={positions()}>
                {(pos) => {
                  const ytSymbol = ytSymbolMap().get(pos.market.ytAddress.toLowerCase()) ?? 'PT/YT';
                  return <PositionRow position={pos} ytSymbol={ytSymbol} />;
                }}
              </For>
            </div>
          </TabsContent>
        </TabsRoot>

        {/* Summary stats */}
        <div class="border-border/50 mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <CoinsIcon class="h-3 w-3" />
              Total PT
            </div>
            <div class="text-foreground font-mono font-semibold">
              {formatCompact(summary().totalPtMinted)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <ClockIcon class="h-3 w-3" />
              Positions
            </div>
            <div class="text-foreground font-mono font-semibold">
              {summary().totalPositions}
            </div>
          </div>
          <div class="text-center">
            <div class="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <TrendingUpIcon class="h-3 w-3" />
              Claimable
            </div>
            <div class="text-primary font-mono font-semibold">
              {formatCompact(summary().totalYield)} SY
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
