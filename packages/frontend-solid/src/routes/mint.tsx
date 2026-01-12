import { useSearchParams } from '@solidjs/router';
import { createEffect, createMemo, on, type JSX, Show } from 'solid-js';

import { type MarketData, useDashboardMarkets } from '@/features/markets';
import { useUIMode } from '@/providers/UIModeProvider';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Mint page - PT/YT minting interface with market selection
 *
 * Features:
 * - Market selection via dropdown with URL persistence
 * - MintForm for minting PT+YT tokens from SY
 * - Responsive layout with market info sidebar
 */
export default function MintPage(): JSX.Element {
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
          {isSimple() ? 'Earn Fixed Yield' : 'Mint PT + YT'}
        </h1>
        <p class="text-muted-foreground mt-2">
          {isSimple()
            ? 'Deposit your tokens to lock in guaranteed fixed returns until maturity.'
            : 'Deposit yield-bearing assets to mint Principal Tokens (PT) and Yield Tokens (YT). PT represents fixed yield, YT represents variable yield.'}
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
            <p class="text-muted-foreground">No active markets available for minting.</p>
          </CardContent>
        </Card>
      </Show>

      {/* Main Content */}
      <Show when={!isLoading() && !isError() && markets().length > 0}>
        <div class="grid gap-6 lg:grid-cols-3">
          {/* Mint Form Column */}
          <div class="lg:col-span-2">
            <Card>
              <CardHeader class="flex flex-row items-center justify-between gap-4">
                <CardTitle>
                  {isSimple() ? 'Deposit' : 'Mint Tokens'}
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
                      Select a market to start minting.
                    </div>
                  }
                >
                  {(market) => <MintFormPlaceholder market={market()} isSimple={isSimple()} />}
                </Show>
              </CardContent>
            </Card>
          </div>

          {/* Market Info Sidebar */}
          <div>
            <Show when={selectedMarket()}>
              {(market) => <MarketInfoCard market={market()} isSimple={isSimple()} />}
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
    if (!market) return 'Select a market';
    return getMarketLabel(market);
  });

  return (
    <SelectRoot<MarketData>
      options={props.markets}
      optionValue="address"
      optionTextValue={(m) => m.metadata?.yieldTokenSymbol ?? 'Unknown'}
      value={props.selectedMarket}
      onChange={props.onSelect}
      placeholder="Select a market"
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
        <SelectValue placeholder="Select a market">
          {selectedLabel()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </SelectRoot>
  );
}

// ============================================================================
// Mint Form Placeholder
// ============================================================================

interface MintFormPlaceholderProps {
  market: MarketData;
  isSimple: boolean;
}

function MintFormPlaceholder(props: MintFormPlaceholderProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');
  const apy = createMemo(() => props.market.impliedApy.multipliedBy(100).toNumber());

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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <div>
            <h4 class="text-foreground font-medium">
              {props.isSimple ? 'How it works' : 'Minting PT + YT'}
            </h4>
            <p class="text-muted-foreground mt-1 text-sm">
              {props.isSimple
                ? `Deposit ${symbol()} to lock in a fixed ${apy().toFixed(2)}% APY until maturity. Your returns are guaranteed regardless of rate changes.`
                : `Deposit SY tokens to mint both Principal Tokens (PT) and Yield Tokens (YT). PT gives you fixed yield at ${apy().toFixed(2)}% APY, while YT captures variable yield until expiry.`}
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder Form */}
      <div class="bg-muted/30 rounded-lg border border-dashed p-8 text-center">
        <div class="text-muted-foreground mx-auto mb-4 h-12 w-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
        </div>
        <h3 class="text-foreground text-lg font-medium">Mint Form Coming Soon</h3>
        <p class="text-muted-foreground mt-2 text-sm">
          The minting interface is being developed. Check back soon!
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Market Info Card
// ============================================================================

interface MarketInfoCardProps {
  market: MarketData;
  isSimple: boolean;
}

function MarketInfoCard(props: MarketInfoCardProps): JSX.Element {
  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');
  const apy = createMemo(() => props.market.impliedApy.multipliedBy(100).toNumber());
  const daysLeft = createMemo(() => props.market.daysToExpiry);

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
        <CardTitle class="text-lg">Market Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {/* Token Symbol */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">Token</span>
            <span class="font-medium">{symbol()}</span>
          </div>

          {/* Implied APY */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">
              {props.isSimple ? 'Fixed Yield' : 'Implied APY'}
            </span>
            <span class="text-primary font-mono font-semibold">
              {apy().toFixed(2)}%
            </span>
          </div>

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
              This market has expired
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

          {/* What you receive section */}
          <div class="border-border mt-4 border-t pt-4">
            <div class="text-muted-foreground mb-3 text-sm font-medium">
              {props.isSimple ? 'What you get' : 'You will receive'}
            </div>
            <div class="space-y-2">
              <div class="bg-primary/5 flex items-center justify-between rounded-md p-2">
                <span class="text-sm font-medium">PT-{symbol()}</span>
                <span class="text-muted-foreground text-xs">
                  {props.isSimple ? 'Fixed yield' : 'Principal Token'}
                </span>
              </div>
              <Show when={!props.isSimple}>
                <div class="bg-chart-2/10 flex items-center justify-between rounded-md p-2">
                  <span class="text-sm font-medium">YT-{symbol()}</span>
                  <span class="text-muted-foreground text-xs">Yield Token</span>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
