import { useSearchParams } from '@solidjs/router';
import { createEffect, createMemo, on, type JSX, Show } from 'solid-js';

import { type MarketData, useDashboardMarkets } from '@/features/markets';
import { useUIMode } from '@/providers/UIModeProvider';
import { cn } from '@/shared/lib/utils';
import { fromWad } from '@/shared/math/wad';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs';

/**
 * Pools page - Liquidity provision interface with market selection
 *
 * Features:
 * - Market selection via dropdown with URL persistence
 * - Add/Remove liquidity forms (tabbed interface)
 * - Pool stats sidebar with TVL, fees, and share info
 */
export default function PoolsPage(): JSX.Element {
  const { isSimple } = useUIMode();
  const [searchParams, setSearchParams] = useSearchParams();

  const { markets, isLoading, isError } = useDashboardMarkets();

  // Get selected market address from URL
  const selectedMarketAddress = createMemo(() => searchParams['market'] ?? null);

  // Find the selected market data
  const selectedMarket = createMemo(() => {
    const address = selectedMarketAddress();
    if (!address) return null;
    return markets().find((m) => m.address === address) ?? null;
  });

  // Auto-select first market if none selected and markets are loaded
  createEffect(
    on(
      () => [markets(), selectedMarketAddress()] as const,
      ([marketList, address]) => {
        if (!address && marketList.length > 0 && marketList[0]) {
          setSearchParams({ market: marketList[0].address }, { replace: true });
        }
      }
    )
  );

  // Handle market selection change
  const handleMarketChange = (market: MarketData | null): void => {
    if (market) {
      setSearchParams({ market: market.address });
    }
  };

  return (
    <div class="mx-auto max-w-7xl px-4 py-8">
      {/* Page Header */}
      <div class="mb-8">
        <h1 class="text-foreground text-3xl font-semibold">
          {isSimple() ? 'Provide Liquidity' : 'Liquidity Pools'}
        </h1>
        <p class="text-muted-foreground mt-2">
          {isSimple()
            ? 'Add liquidity to earn trading fees from PT/SY swaps.'
            : 'Provide liquidity to PT/SY pools to earn trading fees. LP tokens represent your share of the pool.'}
        </p>
      </div>

      {/* Loading State */}
      <Show when={isLoading()}>
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <Skeleton class="h-[500px] rounded-lg" />
          </div>
          <div>
            <Skeleton class="h-[300px] rounded-lg" />
          </div>
        </div>
      </Show>

      {/* Error State */}
      <Show when={isError()}>
        <Card>
          <CardContent class="py-8 text-center">
            <p class="text-destructive">Failed to load markets. Please try again later.</p>
          </CardContent>
        </Card>
      </Show>

      {/* No Markets State */}
      <Show when={!isLoading() && !isError() && markets().length === 0}>
        <Card>
          <CardContent class="py-8 text-center">
            <p class="text-muted-foreground">No active pools available.</p>
          </CardContent>
        </Card>
      </Show>

      {/* Main Content */}
      <Show when={!isLoading() && !isError() && markets().length > 0}>
        <div class="grid gap-6 lg:grid-cols-3">
          {/* Liquidity Form Column */}
          <div class="lg:col-span-2">
            <Card>
              <CardHeader class="flex flex-row items-center justify-between gap-4">
                <CardTitle>
                  {isSimple() ? 'Add Liquidity' : 'Manage Liquidity'}
                </CardTitle>

                {/* Market Selector */}
                <MarketSelector
                  markets={markets()}
                  selectedMarket={selectedMarket()}
                  onSelect={handleMarketChange}
                />
              </CardHeader>
              <CardContent>
                <Show
                  when={selectedMarket()}
                  fallback={
                    <div class="text-muted-foreground py-8 text-center">
                      Select a pool to manage liquidity.
                    </div>
                  }
                >
                  {(market) => <LiquidityForm market={market()} isSimple={isSimple()} />}
                </Show>
              </CardContent>
            </Card>
          </div>

          {/* Pool Info Sidebar */}
          <div>
            <Show when={selectedMarket()}>
              {(market) => <PoolInfoCard market={market()} isSimple={isSimple()} />}
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Market Selector Component
// ============================================================================

interface MarketSelectorProps {
  markets: MarketData[];
  selectedMarket: MarketData | null;
  onSelect: (market: MarketData | null) => void;
}

function MarketSelector(props: MarketSelectorProps): JSX.Element {
  // Format market option for display
  const getMarketLabel = (market: MarketData): string => {
    const symbol = market.metadata?.yieldTokenSymbol ?? 'Unknown';
    const apy = market.impliedApy.multipliedBy(100).toFixed(2);
    return `${symbol} (${apy}% APY)`;
  };

  // Get display text for selected market
  const selectedLabel = createMemo(() => {
    const market = props.selectedMarket;
    if (!market) return 'Select a pool';
    return getMarketLabel(market);
  });

  return (
    <SelectRoot<MarketData>
      options={props.markets}
      optionValue="address"
      optionTextValue={(m) => m.metadata?.yieldTokenSymbol ?? 'Unknown'}
      value={props.selectedMarket}
      onChange={props.onSelect}
      placeholder="Select a pool"
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>
          <div class="flex items-center justify-between gap-4">
            <span class="font-medium">
              {itemProps.item.rawValue.metadata?.yieldTokenSymbol ?? 'Unknown'}
            </span>
            <span class="text-muted-foreground text-xs">
              {itemProps.item.rawValue.impliedApy.multipliedBy(100).toFixed(2)}% APY
            </span>
          </div>
        </SelectItem>
      )}
    >
      <SelectTrigger class="w-48">
        <SelectValue placeholder="Select a pool">
          {selectedLabel()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </SelectRoot>
  );
}

// ============================================================================
// Liquidity Form Component
// ============================================================================

interface LiquidityFormProps {
  market: MarketData;
  isSimple: boolean;
}

function LiquidityForm(props: LiquidityFormProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');

  return (
    <div class="space-y-6 py-4">
      {/* Info Banner */}
      <div class="bg-primary/5 border-primary/20 rounded-lg border p-4">
        <div class="flex items-start gap-3">
          <div class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2v20M2 12h20" />
            </svg>
          </div>
          <div>
            <h4 class="text-foreground font-medium">
              {props.isSimple ? 'Earn Trading Fees' : 'Liquidity Provision'}
            </h4>
            <p class="text-muted-foreground mt-1 text-sm">
              {props.isSimple
                ? `Add liquidity to the ${symbol()} pool to earn a share of trading fees from PT/SY swaps.`
                : `Provide PT and SY tokens to the ${symbol()} pool. You'll receive LP tokens representing your share of the pool and earn trading fees proportional to your stake.`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed Form Interface */}
      <Show
        when={!props.isSimple}
        fallback={<AddLiquidityPlaceholder market={props.market} isSimple={props.isSimple} />}
      >
        <Tabs defaultValue="add">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add Liquidity</TabsTrigger>
            <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
          </TabsList>
          <TabsContent value="add" class="pt-4">
            <AddLiquidityPlaceholder market={props.market} isSimple={props.isSimple} />
          </TabsContent>
          <TabsContent value="remove" class="pt-4">
            <RemoveLiquidityPlaceholder market={props.market} />
          </TabsContent>
        </Tabs>
      </Show>
    </div>
  );
}

// ============================================================================
// Add Liquidity Placeholder
// ============================================================================

interface AddLiquidityPlaceholderProps {
  market: MarketData;
  isSimple: boolean;
}

function AddLiquidityPlaceholder(props: AddLiquidityPlaceholderProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');

  return (
    <div class="space-y-4">
      {/* Token Input Placeholders */}
      <div class="space-y-3">
        <div class="bg-muted/30 rounded-lg border p-4">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">PT-{symbol()}</span>
            <span class="text-muted-foreground text-xs">Balance: --</span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="0.0"
              disabled
              class="bg-transparent text-foreground w-full text-2xl font-mono outline-none"
            />
            <Button variant="ghost" size="sm" disabled>
              MAX
            </Button>
          </div>
        </div>

        <div class="bg-muted/30 rounded-lg border p-4">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">SY-{symbol()}</span>
            <span class="text-muted-foreground text-xs">Balance: --</span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="0.0"
              disabled
              class="bg-transparent text-foreground w-full text-2xl font-mono outline-none"
            />
            <Button variant="ghost" size="sm" disabled>
              MAX
            </Button>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div class="bg-muted/30 rounded-lg border border-dashed p-6 text-center">
        <div class="text-muted-foreground mx-auto mb-3 h-10 w-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        </div>
        <h3 class="text-foreground font-medium">Add Liquidity Coming Soon</h3>
        <p class="text-muted-foreground mt-1 text-sm">
          The liquidity provision interface is being developed.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Remove Liquidity Placeholder
// ============================================================================

interface RemoveLiquidityPlaceholderProps {
  market: MarketData;
}

function RemoveLiquidityPlaceholder(props: RemoveLiquidityPlaceholderProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');

  return (
    <div class="space-y-4">
      {/* LP Token Input Placeholder */}
      <div class="bg-muted/30 rounded-lg border p-4">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-sm">LP-{symbol()}</span>
          <span class="text-muted-foreground text-xs">Balance: --</span>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="0.0"
            disabled
            class="bg-transparent text-foreground w-full text-2xl font-mono outline-none"
          />
          <Button variant="ghost" size="sm" disabled>
            MAX
          </Button>
        </div>
      </div>

      {/* Output Preview */}
      <div class="bg-muted/20 rounded-lg p-4">
        <div class="text-muted-foreground mb-2 text-sm">You will receive</div>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm">PT-{symbol()}</span>
            <span class="font-mono">--</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">SY-{symbol()}</span>
            <span class="font-mono">--</span>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div class="bg-muted/30 rounded-lg border border-dashed p-6 text-center">
        <div class="text-muted-foreground mx-auto mb-3 h-10 w-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        </div>
        <h3 class="text-foreground font-medium">Remove Liquidity Coming Soon</h3>
        <p class="text-muted-foreground mt-1 text-sm">
          The liquidity removal interface is being developed.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Pool Info Card
// ============================================================================

interface PoolInfoCardProps {
  market: MarketData;
  isSimple: boolean;
}

function PoolInfoCard(props: PoolInfoCardProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');
  const apy = createMemo(() => props.market.impliedApy.multipliedBy(100).toNumber());
  const daysLeft = createMemo(() => props.market.daysToExpiry);

  // Pool reserves
  const ptReserve = createMemo(() => {
    const value = Number(fromWad(props.market.state.ptReserve));
    return formatCompact(value);
  });

  const syReserve = createMemo(() => {
    const value = Number(fromWad(props.market.state.syReserve));
    return formatCompact(value);
  });

  const totalLp = createMemo(() => {
    const value = Number(fromWad(props.market.state.totalLpSupply));
    return formatCompact(value);
  });

  const expiryDate = createMemo(() => {
    const date = new Date(props.market.expiry * 1000);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle class="text-lg">Pool Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {/* Token Symbol */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">Pool</span>
            <span class="font-medium">PT-{symbol()} / SY</span>
          </div>

          {/* Implied APY */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">
              {props.isSimple ? 'Pool Rate' : 'Implied APY'}
            </span>
            <span class="text-primary font-mono font-semibold">
              {apy().toFixed(2)}%
            </span>
          </div>

          {/* Pool Reserves */}
          <Show when={!props.isSimple}>
            <div class="border-border space-y-3 border-t pt-4">
              <div class="text-muted-foreground text-xs font-medium uppercase">
                Pool Reserves
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-sm">PT Reserve</span>
                <span class="font-mono text-sm">{ptReserve()}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-sm">SY Reserve</span>
                <span class="font-mono text-sm">{syReserve()}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-sm">Total LP</span>
                <span class="font-mono text-sm">{totalLp()}</span>
              </div>
            </div>
          </Show>

          {/* Expiry */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">Expiry Date</span>
            <span class="font-mono text-sm">{expiryDate()}</span>
          </div>

          {/* Days to Expiry */}
          <Show when={!props.market.isExpired}>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground text-sm">
                {props.isSimple ? 'Time Remaining' : 'Days to Expiry'}
              </span>
              <span class="font-mono text-sm">
                {daysLeft()} {daysLeft() === 1 ? 'day' : 'days'}
              </span>
            </div>
          </Show>

          {/* Expired Badge */}
          <Show when={props.market.isExpired}>
            <div class="bg-destructive/10 text-destructive rounded-lg p-3 text-center text-sm font-medium">
              This pool has expired
            </div>
          </Show>

          {/* Oracle Status */}
          <Show when={!props.isSimple}>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground text-sm">Oracle</span>
              <span
                class={cn(
                  'text-xs font-medium',
                  props.market.oracleState === 'ready' && 'text-success',
                  props.market.oracleState === 'partial' && 'text-warning',
                  props.market.oracleState === 'spot-only' && 'text-muted-foreground'
                )}
              >
                {props.market.oracleState === 'ready' && 'TWAP Ready'}
                {props.market.oracleState === 'partial' && 'Warming Up'}
                {props.market.oracleState === 'spot-only' && 'Spot Only'}
              </span>
            </div>
          </Show>

          {/* Your Position (placeholder) */}
          <div class="border-border mt-4 border-t pt-4">
            <div class="text-muted-foreground mb-3 text-sm font-medium">Your Position</div>
            <div class="bg-muted/30 rounded-lg p-3 text-center">
              <span class="text-muted-foreground text-sm">Connect wallet to view</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
