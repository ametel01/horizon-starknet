'use client';

import { useDashboardMarkets } from '@features/markets';
import { usePositions } from '@features/portfolio';
import { SwapForm, TokenAggregatorSwapForm } from '@features/swap';
import { useStarknet } from '@features/wallet';
import { ApyBreakdown, useApyBreakdown } from '@features/yield';
import { useHydrated } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@shared/ui';
import { ClientDateText } from '@shared/ui/client-time';
import { Skeleton, SkeletonCard } from '@shared/ui/Skeleton';
import { ArrowRightLeft, BookOpen, Info, TrendingUp, Wallet, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================================
// Constants
// ============================================================================

// Version localStorage keys to prevent data corruption on schema changes
const STORAGE_VERSION = 'v1';
const FORM_MODE_STORAGE_KEY = `horizon-trade-form-mode-${STORAGE_VERSION}`;
type FormMode = 'standard' | 'any-token';

// Lazy load chart components (recharts is heavy)
const ImpliedRateChart = dynamic(
  () => import('@widgets/analytics/ImpliedRateChart').then((m) => m.ImpliedRateChart),
  { loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />, ssr: false }
);

const SwapHistoryTable = dynamic(
  () => import('@widgets/analytics/SwapHistoryTable').then((m) => m.SwapHistoryTable),
  { loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> }
);

// Helper to get market symbol
function getMarketSymbol(market: {
  metadata?: { yieldTokenSymbol?: string };
  address: string;
}): string {
  return market.metadata?.yieldTokenSymbol ?? market.address.slice(0, 8);
}

/**
 * Renders loading, error, or empty state messages for trade page.
 * Returns null if data is ready to render.
 */
interface LoadingStateProps {
  mounted: boolean;
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
}

function TradeLoadingState({ mounted, isLoading, isError, hasData }: LoadingStateProps): ReactNode {
  if (!mounted || isLoading) {
    return <SkeletonCard className="h-[600px]" />;
  }

  if (isError) {
    return (
      <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-8 text-center">
        <p className="text-destructive">Failed to load markets. Please try again.</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="border-border bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No markets available.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Markets will appear here once they are created.
        </p>
      </div>
    );
  }

  return null;
}

function TradePageContent(): ReactNode {
  return useTradePageContent();
}

function useTradePageContent(): ReactNode {
  const { push } = useRouter();
  const { get } = useSearchParams();
  const marketParam = get('market');
  const mounted = useHydrated();
  const { isConnected } = useStarknet();

  // Form mode state with localStorage persistence
  const [formMode, setFormMode] = useState<FormMode>('standard');

  // Load form mode preference from localStorage on mount
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(FORM_MODE_STORAGE_KEY);
      if (savedMode === 'standard' || savedMode === 'any-token') {
        setFormMode(savedMode);
      }
    } catch {
      // localStorage unavailable (private browsing, disabled cookies, etc.)
    }
  }, []);

  // Handle form mode change with localStorage persistence
  const handleFormModeChange = useCallback((value: unknown) => {
    if (value !== 'standard' && value !== 'any-token') return;
    setFormMode(value);
    try {
      localStorage.setItem(FORM_MODE_STORAGE_KEY, value);
    } catch {
      // localStorage unavailable, mode still works in memory
    }
  }, []);

  const { markets, isLoading, isError } = useDashboardMarkets();

  // Handle market selection change
  const handleMarketChange = useCallback(
    (marketAddress: string) => {
      push(`/trade?market=${marketAddress}`);
    },
    [push]
  );

  // Select market based on URL param or default to first market
  const selectedMarket = useMemo(() => {
    if (marketParam) {
      return markets.find((m) => m.address === marketParam);
    }
    return markets[0];
  }, [markets, marketParam]);

  // Fetch user's position for the selected market
  const marketsToQuery = useMemo(() => (selectedMarket ? [selectedMarket] : []), [selectedMarket]);
  const { data: portfolio } = usePositions(marketsToQuery);
  const position = portfolio?.positions[0];

  // Fetch APY breakdown for the selected market
  const { data: apyBreakdown } = useApyBreakdown(selectedMarket);

  // Get token symbols
  const tokenSymbol = selectedMarket?.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;
  const ytSymbol = `YT-${tokenSymbol}`;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Swap Form */}
        <div>
          <TradeLoadingState
            mounted={mounted}
            isLoading={isLoading}
            isError={isError}
            hasData={!!selectedMarket}
          />
          {selectedMarket && mounted && !isLoading && !isError && (
            <div className="space-y-4">
              {/* Market Selector */}
              <div>
                <span
                  id="trade-market-selector-label"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Select Market
                </span>
                <Select
                  value={selectedMarket.address}
                  onValueChange={(value) => {
                    if (value) handleMarketChange(value);
                  }}
                >
                  <SelectTrigger className="w-full" aria-labelledby="trade-market-selector-label">
                    <SelectValue>
                      {getMarketSymbol(selectedMarket)} -{' '}
                      {selectedMarket.metadata?.yieldTokenName ?? 'Unknown'} (
                      {selectedMarket.impliedApy.multipliedBy(100).toFixed(1)}% APY)
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map((market) => (
                      <SelectItem key={market.address} value={market.address}>
                        <div className="flex items-center justify-between gap-4">
                          <span>
                            {getMarketSymbol(market)} -{' '}
                            {market.metadata?.yieldTokenName ?? 'Unknown'}
                          </span>
                          <span className="text-primary font-mono text-sm">
                            {market.impliedApy.multipliedBy(100).toFixed(1)}%
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Form Mode Tabs */}
              <Tabs value={formMode} onValueChange={handleFormModeChange}>
                <TabsList className="w-full">
                  <TabsTrigger value="standard" className="flex-1 gap-1.5">
                    <ArrowRightLeft className="size-3.5" />
                    Standard
                  </TabsTrigger>
                  <TabsTrigger value="any-token" className="flex-1 gap-1.5">
                    <Zap className="size-3.5" />
                    Any Token
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="standard">
                  <SwapForm key={`standard-${selectedMarket.address}`} market={selectedMarket} />
                </TabsContent>
                <TabsContent value="any-token">
                  <TokenAggregatorSwapForm
                    key={`any-token-${selectedMarket.address}`}
                    market={selectedMarket}
                  />
                </TabsContent>
              </Tabs>

              {/* Implied Rate Chart */}
              <ImpliedRateChart
                marketAddress={selectedMarket.address}
                height={200}
                showControls={true}
                initialResolution="daily"
                initialDays={30}
              />
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Your Position */}
          {isConnected && selectedMarket && position && (
            <div
              className={cn(
                'border-border/50 bg-card overflow-hidden rounded-xl border',
                'translate-y-2 opacity-0',
                mounted && 'translate-y-0 opacity-100',
                'transition-all duration-300'
              )}
            >
              <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
                <Wallet className="text-primary size-4" />
                <h3 className="text-foreground text-sm font-semibold">Your Position</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      {sySymbol}
                    </div>
                    <div className="text-foreground mt-1 font-mono text-lg">
                      {formatWadCompact(position.syBalance)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      {ptSymbol}
                    </div>
                    <div className="text-foreground mt-1 font-mono text-lg">
                      {formatWadCompact(position.ptBalance)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      {ytSymbol}
                    </div>
                    <div className="text-foreground mt-1 font-mono text-lg">
                      {formatWadCompact(position.ytBalance)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      LP Tokens
                    </div>
                    <div className="text-foreground mt-1 font-mono text-lg">
                      {formatWadCompact(position.lpBalance)}
                    </div>
                  </div>
                </div>
                {/* LP Value breakdown if user has LP */}
                {position.lpBalance > BigInt(0) && (
                  <div className="border-chart-2/30 bg-chart-2/10 mt-3 rounded-lg border p-3">
                    <div className="text-chart-2 mb-2 text-xs font-medium">
                      LP Value (
                      {position.lpSharePercent < 0.01
                        ? '< 0.01'
                        : position.lpSharePercent.toFixed(2)}
                      % of pool)
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{sySymbol}:</span>
                      <span className="text-foreground font-mono">
                        {formatWadCompact(position.lpValueSy)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{ptSymbol}:</span>
                      <span className="text-foreground font-mono">
                        {formatWadCompact(position.lpValuePt)}
                      </span>
                    </div>
                    <div className="border-chart-2/20 mt-2 border-t pt-2">
                      <div className="text-chart-2 flex items-center gap-1 text-xs">
                        <TrendingUp className="size-3" />
                        Swap fees auto-compound into LP
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APY Breakdown Cards */}
          {selectedMarket !== undefined && apyBreakdown !== null && (
            <div className="space-y-4">
              <ApyBreakdown breakdown={apyBreakdown} view="pt" title="PT Fixed Yield" />
              <ApyBreakdown breakdown={apyBreakdown} view="yt" title="YT Long Yield" />
            </div>
          )}

          {/* How Trading Works */}
          {selectedMarket && (
            <div
              className={cn(
                'border-border/50 bg-card overflow-hidden rounded-xl border',
                'translate-y-2 opacity-0',
                mounted && 'translate-y-0 opacity-100',
                'transition-all delay-100 duration-300'
              )}
            >
              <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
                <Info className="text-muted-foreground size-4" />
                <h3 className="text-foreground text-sm font-semibold">How Trading Works</h3>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-secondary/20 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                      PT
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">Principal Token</p>
                      <p className="text-muted-foreground text-xs">
                        Buy at discount for fixed yield. Redeems 1:1 at expiry.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-primary/20 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                      YT
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">Yield Token</p>
                      <p className="text-muted-foreground text-xs">
                        Speculate on yields. Claim all yield until expiry.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-chart-2/20 text-chart-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                      %
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        Implied APY:{' '}
                        <span className="text-primary font-mono">
                          {selectedMarket.impliedApy.multipliedBy(100).toFixed(2)}%
                        </span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Current market rate derived from PT price.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Market Info */}
                <div className="border-border/50 space-y-3 border-t pt-4">
                  <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Market Info
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs">Days to Expiry</div>
                      <div className="text-foreground mt-1 font-mono text-sm">
                        {selectedMarket.daysToExpiry > 0
                          ? `${String(Math.round(selectedMarket.daysToExpiry))} days`
                          : 'Expired'}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs">Expiry Date</div>
                      <div className="text-foreground mt-1 text-sm">
                        <ClientDateText value={selectedMarket.expiry * 1000} />
                      </div>
                    </div>
                    <div className="bg-muted/50 col-span-2 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs">Pool TVL</div>
                      <div className="text-foreground mt-1 font-mono text-sm">
                        {formatWadCompact(selectedMarket.tvlSy)} {sySymbol}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Tips */}
                <div className="border-border/50 space-y-3 border-t pt-4">
                  <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Quick Tips
                  </h4>
                  <ul className="text-muted-foreground space-y-2 text-xs">
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>PT holders lock in fixed yield regardless of rate changes</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>YT profits if underlying yield exceeds implied APY</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Both tokens can be traded anytime before expiry</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>After expiry, PT redeems 1:1 and YT becomes worthless</span>
                    </li>
                  </ul>
                </div>

                {/* Learn More Link */}
                <div className="border-border/50 border-t pt-4">
                  <Link
                    href="/docs"
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                  >
                    <BookOpen className="size-3.5" />
                    Learn more about yield trading
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Swap History Table - Full width below */}
      {selectedMarket && <SwapHistoryTable marketAddress={selectedMarket.address} limit={20} />}
    </div>
  );
}

export function TradePage(): ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-10 items-center justify-center rounded-full">
            <ArrowRightLeft className="text-primary size-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Trade</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Swap PT for fixed yields or YT to speculate on rates
            </p>
          </div>
        </div>
      </header>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[600px] max-w-lg" />}>
        <TradePageContent />
      </Suspense>
    </div>
  );
}
