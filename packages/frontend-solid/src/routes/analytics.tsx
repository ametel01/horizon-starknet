import { A } from '@solidjs/router';
import { createMemo, For, type JSX, Show } from 'solid-js';

import { useDashboardMarkets, type MarketData } from '@/features/markets';
import { useUIMode } from '@/providers/UIModeProvider';
import { cn } from '@/shared/lib/utils';
import { fromWad } from '@/shared/math/wad';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Analytics page - Protocol statistics and metrics
 *
 * Features:
 * - Protocol-level stats (TVL, market count, avg APY)
 * - Market breakdown table with individual stats
 * - Mode-aware display (simple vs pro)
 */
export default function AnalyticsPage(): JSX.Element {
  const { isSimple } = useUIMode();
  const { markets, avgApy, isLoading, isError } = useDashboardMarkets();

  // Calculate protocol-level TVL
  const totalTvl = createMemo(() => {
    const data = markets();
    let tvl = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      tvl += syReserve + ptReserve;
    }
    return tvl;
  });

  // Calculate total LP tokens
  const totalLp = createMemo(() => {
    const data = markets();
    let lp = 0;
    for (const market of data) {
      lp += Number(fromWad(market.state.totalLpSupply));
    }
    return lp;
  });

  // Average APY as percentage
  const avgApyPercent = createMemo(() => {
    const apy = avgApy();
    const value = apy.multipliedBy(100).toNumber();
    return Number.isFinite(value) ? value : 0;
  });

  // Count active (non-expired) markets
  const activeMarketsCount = createMemo(() => {
    return markets().filter((m) => !m.isExpired).length;
  });

  // Count expired markets
  const expiredMarketsCount = createMemo(() => {
    return markets().filter((m) => m.isExpired).length;
  });

  return (
    <div class="mx-auto max-w-7xl px-4 py-8">
      {/* Page Header */}
      <div class="mb-8">
        <h1 class="text-foreground text-3xl font-semibold">
          {isSimple() ? 'Protocol Stats' : 'Analytics'}
        </h1>
        <p class="text-muted-foreground mt-2">
          {isSimple()
            ? 'View overall protocol performance and market statistics.'
            : 'Protocol metrics, market breakdown, and historical data.'}
        </p>
      </div>

      {/* Loading State */}
      <Show when={isLoading()}>
        <div class="space-y-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <Skeleton class="h-[400px] rounded-lg" />
        </div>
      </Show>

      {/* Error State */}
      <Show when={!isLoading() && isError()}>
        <Card>
          <CardContent class="py-8 text-center">
            <p class="text-destructive">Failed to load analytics data. Please try again later.</p>
          </CardContent>
        </Card>
      </Show>

      {/* Main Content */}
      <Show when={!isLoading() && !isError()}>
        <div class="space-y-8">
          {/* Protocol Stats Cards */}
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Value Locked"
              value={totalTvl()}
              formatter={formatCompact}
              highlight
            />
            <StatCard
              label={isSimple() ? 'Average Yield' : 'Avg. Implied APY'}
              value={avgApyPercent()}
              formatter={(v) => `${v.toFixed(2)}%`}
            />
            <StatCard
              label="Active Markets"
              value={activeMarketsCount()}
              formatter={(v) => String(Math.round(v))}
            />
            <Show when={!isSimple()}>
              <StatCard
                label="Total LP Supply"
                value={totalLp()}
                formatter={formatCompact}
              />
            </Show>
            <Show when={isSimple()}>
              <StatCard
                label="Total Markets"
                value={markets().length}
                formatter={(v) => String(Math.round(v))}
              />
            </Show>
          </div>

          {/* Markets Breakdown */}
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle>
                  {isSimple() ? 'Market Performance' : 'Markets Breakdown'}
                </CardTitle>
                <A
                  href="/trade"
                  class="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                >
                  Trade →
                </A>
              </div>
            </CardHeader>
            <CardContent>
              <Show
                when={markets().length > 0}
                fallback={
                  <div class="text-muted-foreground py-8 text-center">
                    No markets available.
                  </div>
                }
              >
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="border-border border-b">
                        <th class="text-muted-foreground pb-3 text-left text-sm font-medium">
                          Market
                        </th>
                        <th class="text-muted-foreground pb-3 text-right text-sm font-medium">
                          {isSimple() ? 'Yield' : 'Implied APY'}
                        </th>
                        <th class="text-muted-foreground pb-3 text-right text-sm font-medium">
                          TVL
                        </th>
                        <Show when={!isSimple()}>
                          <th class="text-muted-foreground pb-3 text-right text-sm font-medium">
                            PT Reserve
                          </th>
                          <th class="text-muted-foreground pb-3 text-right text-sm font-medium">
                            SY Reserve
                          </th>
                        </Show>
                        <th class="text-muted-foreground pb-3 text-right text-sm font-medium">
                          {isSimple() ? 'Time Left' : 'Days to Expiry'}
                        </th>
                        <th class="text-muted-foreground pb-3 text-right text-sm font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={markets()}>
                        {(market) => (
                          <MarketRow market={market} isSimple={isSimple()} />
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </CardContent>
          </Card>

          {/* Additional Stats (Pro Mode Only) */}
          <Show when={!isSimple()}>
            <div class="grid gap-6 lg:grid-cols-2">
              {/* Market Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle class="text-lg">Market Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div class="bg-success h-3 w-3 rounded-full" />
                        <span class="text-muted-foreground text-sm">Active Markets</span>
                      </div>
                      <span class="font-mono font-medium">{activeMarketsCount()}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div class="bg-muted-foreground h-3 w-3 rounded-full" />
                        <span class="text-muted-foreground text-sm">Expired Markets</span>
                      </div>
                      <span class="font-mono font-medium">{expiredMarketsCount()}</span>
                    </div>
                    <div class="border-border flex items-center justify-between border-t pt-4">
                      <span class="text-foreground text-sm font-medium">Total Markets</span>
                      <span class="font-mono font-semibold">{markets().length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Protocol Info */}
              <Card>
                <CardHeader>
                  <CardTitle class="text-lg">Protocol Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground text-sm">Network</span>
                      <span class="font-medium">Starknet</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground text-sm">Protocol</span>
                      <span class="font-medium">Horizon</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground text-sm">Version</span>
                      <span class="font-mono text-sm">v2.0</span>
                    </div>
                    <div class="border-border border-t pt-4">
                      <div class="bg-muted/30 rounded-lg p-3 text-center">
                        <span class="text-muted-foreground text-xs">
                          Historical charts and advanced analytics coming soon
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  label: string;
  value: number;
  formatter: (value: number) => string;
  highlight?: boolean;
}

function StatCard(props: StatCardProps): JSX.Element {
  return (
    <Card
      class={cn(
        'transition-all',
        props.highlight && 'border-primary/30 bg-primary/5'
      )}
    >
      <CardContent class="pt-6">
        <div class="text-muted-foreground text-sm">{props.label}</div>
        <div
          class={cn(
            'mt-2 font-mono text-2xl font-semibold',
            props.highlight ? 'text-primary' : 'text-foreground'
          )}
        >
          <AnimatedNumber value={props.value} formatter={props.formatter} duration={800} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent class="pt-6">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="mt-2 h-8 w-32" />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Market Row Component
// ============================================================================

interface MarketRowProps {
  market: MarketData;
  isSimple: boolean;
}

function MarketRow(props: MarketRowProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');
  const apy = createMemo(() => props.market.impliedApy.multipliedBy(100).toNumber());
  const daysLeft = createMemo(() => props.market.daysToExpiry);

  const tvl = createMemo(() => {
    const syReserve = Number(fromWad(props.market.state.syReserve));
    const ptReserve = Number(fromWad(props.market.state.ptReserve));
    return syReserve + ptReserve;
  });

  const ptReserve = createMemo(() => Number(fromWad(props.market.state.ptReserve)));
  const syReserve = createMemo(() => Number(fromWad(props.market.state.syReserve)));

  return (
    <tr class="border-border hover:bg-muted/30 border-b transition-colors last:border-0">
      <td class="py-4">
        <A
          href={`/trade?market=${props.market.address}`}
          class="text-foreground hover:text-primary font-medium transition-colors"
        >
          {symbol()}
        </A>
      </td>
      <td class="text-primary py-4 text-right font-mono">
        {apy().toFixed(2)}%
      </td>
      <td class="py-4 text-right font-mono">
        {formatCompact(tvl())}
      </td>
      <Show when={!props.isSimple}>
        <td class="text-muted-foreground py-4 text-right font-mono text-sm">
          {formatCompact(ptReserve())}
        </td>
        <td class="text-muted-foreground py-4 text-right font-mono text-sm">
          {formatCompact(syReserve())}
        </td>
      </Show>
      <td class="py-4 text-right font-mono">
        <Show when={!props.market.isExpired} fallback="--">
          {daysLeft()}d
        </Show>
      </td>
      <td class="py-4 text-right">
        <span
          class={cn(
            'inline-flex rounded-full px-2 py-1 text-xs font-medium',
            props.market.isExpired
              ? 'bg-muted text-muted-foreground'
              : daysLeft() <= 7
                ? 'bg-warning/10 text-warning'
                : 'bg-success/10 text-success'
          )}
        >
          {props.market.isExpired ? 'Expired' : daysLeft() <= 7 ? 'Expiring' : 'Active'}
        </span>
      </td>
    </tr>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCompact(value: number): string {
  if (value === 0) return '0';
  if (value < 0) return `-${formatCompact(-value)}`;
  if (value < 0.01) return '<0.01';
  if (value < 1000) return value.toFixed(2);
  if (value < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}
