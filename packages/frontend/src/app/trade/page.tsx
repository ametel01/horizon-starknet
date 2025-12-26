'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { useDashboardMarkets } from '@features/markets';
import { usePositions } from '@features/portfolio';
import { SwapForm } from '@features/swap';
import { useStarknet } from '@features/wallet';
import { useApyBreakdown, ApyBreakdown } from '@features/yield';
import { formatWadCompact } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton, SkeletonCard } from '@shared/ui/Skeleton';

// Lazy load chart components (recharts is heavy)
const ImpliedRateChart = dynamic(
  () => import('@/components/analytics/ImpliedRateChart').then((m) => m.ImpliedRateChart),
  { loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />, ssr: false }
);

const SwapHistoryTable = dynamic(
  () => import('@/components/analytics/SwapHistoryTable').then((m) => m.SwapHistoryTable),
  { loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> }
);

// Helper to get market symbol
function getMarketSymbol(market: {
  metadata?: { yieldTokenSymbol?: string };
  address: string;
}): string {
  return market.metadata?.yieldTokenSymbol ?? market.address.slice(0, 8);
}

function TradePageContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketParam = searchParams.get('market');
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useStarknet();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { markets, isLoading, isError } = useDashboardMarkets();

  // Handle market selection change
  const handleMarketChange = useCallback(
    (marketAddress: string) => {
      router.push(`/trade?market=${marketAddress}`);
    },
    [router]
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
          {!mounted || isLoading ? (
            <SkeletonCard className="h-[600px]" />
          ) : isError ? (
            <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-8 text-center">
              <p className="text-destructive">Failed to load markets. Please try again.</p>
            </div>
          ) : !selectedMarket ? (
            <div className="border-border bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">No markets available.</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Markets will appear here once they are created.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Market Selector */}
              {markets.length > 1 && (
                <Card>
                  <CardContent className="pt-4">
                    <label className="text-muted-foreground mb-2 block text-sm font-medium">
                      Select Market
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {markets.map((market) => (
                        <Button
                          key={market.address}
                          variant={
                            market.address === selectedMarket.address ? 'default' : 'outline'
                          }
                          size="sm"
                          onClick={() => {
                            handleMarketChange(market.address);
                          }}
                          className="flex items-center gap-2"
                        >
                          <span className="font-medium">{getMarketSymbol(market)}</span>
                          <span
                            className={
                              market.address === selectedMarket.address
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }
                          >
                            {market.impliedApy.multipliedBy(100).toFixed(1)}%
                          </span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Swap Form */}
              <SwapForm market={selectedMarket} />

              {/* Implied Rate Chart */}
              <ImpliedRateChart
                marketAddress={selectedMarket.address}
                height={200}
                showControls={true}
                defaultResolution="daily"
                defaultDays={30}
              />
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Your Position */}
          {isConnected && selectedMarket && position && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted rounded-lg p-2">
                    <div className="text-muted-foreground text-xs">{sySymbol}</div>
                    <div className="text-foreground font-mono">
                      {formatWadCompact(position.syBalance)}
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <div className="text-muted-foreground text-xs">{ptSymbol}</div>
                    <div className="text-foreground font-mono">
                      {formatWadCompact(position.ptBalance)}
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <div className="text-muted-foreground text-xs">{ytSymbol}</div>
                    <div className="text-foreground font-mono">
                      {formatWadCompact(position.ytBalance)}
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <div className="text-muted-foreground text-xs">LP Tokens</div>
                    <div className="text-foreground font-mono">
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
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                        Swap fees auto-compound into LP
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
            <div className="border-border bg-card rounded-lg border p-4">
              <h3 className="text-foreground mb-3 text-sm font-semibold">How Trading Works</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="bg-secondary/20 text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
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
                  <div className="bg-primary/20 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
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
                  <div className="bg-chart-2/20 text-chart-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    %
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      Implied APY:{' '}
                      <span className="text-primary">
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
              <div className="border-border mt-4 space-y-2 border-t pt-4">
                <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Market Info
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Days to Expiry</div>
                    <div className="text-foreground text-sm">
                      {selectedMarket.daysToExpiry > 0
                        ? `${String(Math.round(selectedMarket.daysToExpiry))} days`
                        : 'Expired'}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Expiry Date</div>
                    <div className="text-foreground text-sm">
                      {new Date(selectedMarket.expiry * 1000).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="bg-muted/50 col-span-2 rounded p-2">
                    <div className="text-muted-foreground text-xs">Pool TVL</div>
                    <div className="text-foreground font-mono text-sm">
                      {formatWadCompact(selectedMarket.tvlSy)} {sySymbol}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Tips */}
              <div className="border-border mt-4 space-y-2 border-t pt-4">
                <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Quick Tips
                </h4>
                <ul className="text-muted-foreground space-y-1.5 text-xs">
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
              <div className="mt-auto pt-4">
                <Link
                  href="/docs"
                  className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium"
                >
                  Learn more about yield trading
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          )}
        </div>
      </div>

      {/* Swap History Table - Full width below */}
      {selectedMarket && <SwapHistoryTable marketAddress={selectedMarket.address} limit={20} />}
    </div>
  );
}

export default function TradePage(): ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-foreground text-3xl font-bold">Trade</h1>
        <p className="text-muted-foreground mt-2">
          Trade PT for fixed yields or YT to speculate on yield rates
        </p>
      </div>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[600px] max-w-lg" />}>
        <TradePageContent />
      </Suspense>
    </div>
  );
}
