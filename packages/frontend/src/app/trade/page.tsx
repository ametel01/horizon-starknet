'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { ApyBreakdownCard } from '@/components/display/ApyBreakdown';
import { SwapForm } from '@/components/forms/SwapForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useApyBreakdown } from '@/hooks/useApyBreakdown';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { usePositions } from '@/hooks/usePositions';
import { useStarknet } from '@/hooks/useStarknet';
import { formatWadCompact } from '@/lib/math/wad';

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
    <div className="flex flex-col items-center lg:flex-row lg:items-start lg:gap-8">
      {/* Swap Form */}
      <div className="w-full max-w-lg">
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
                        variant={market.address === selectedMarket.address ? 'default' : 'outline'}
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
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 w-full max-w-md lg:mt-0">
        {/* Your Position */}
        {isConnected && selectedMarket && position && (
          <Card className="mb-4">
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
                    {position.lpSharePercent < 0.01 ? '< 0.01' : position.lpSharePercent.toFixed(2)}
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
        {selectedMarket !== undefined && apyBreakdown !== undefined && (
          <div className="mb-4 space-y-4">
            <ApyBreakdownCard breakdown={apyBreakdown} view="pt" title="PT Fixed Yield" />
            <ApyBreakdownCard breakdown={apyBreakdown} view="yt" title="YT Long Yield" />
          </div>
        )}

        <div className="border-border bg-card rounded-lg border p-6">
          <h2 className="text-foreground text-lg font-semibold">How Trading Works</h2>
          <div className="text-muted-foreground mt-4 space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="bg-secondary/20 text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                PT
              </div>
              <div>
                <p className="text-foreground font-medium">Principal Token (PT)</p>
                <p className="mt-1">
                  Buy PT at a discount for fixed yield. PT redeems for the underlying token at
                  expiry. PT price rises when rates fall and falls when rates rise.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                YT
              </div>
              <div>
                <p className="text-foreground font-medium">Yield Token (YT)</p>
                <p className="mt-1">
                  Buy YT to speculate on rising yields. YT gives you the right to claim all yield
                  until expiry. YT expires worthless but can be very profitable if yields are high.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                $
              </div>
              <div>
                <p className="text-foreground font-medium">Trading Strategies</p>
                <p className="mt-1">
                  <span className="text-foreground">Fixed Yield:</span> Buy PT, hold to expiry.
                  <br />
                  <span className="text-foreground">Yield Bull:</span> Buy YT, profit if yields
                  exceed implied APY.
                  <br />
                  <span className="text-foreground">Yield Bear:</span> Sell YT, profit if yields
                  stay low.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted mt-6 rounded-lg p-4">
            <h3 className="text-foreground text-sm font-medium">Implied Yield</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              The implied yield is derived from the PT price. Buying PT at a lower price means a
              higher implied yield for your investment.
            </p>
            {selectedMarket && (
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Current Implied APY:</span>
                <span className="text-primary font-medium">
                  {selectedMarket.impliedApy.multipliedBy(100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <div className="bg-muted mt-4 rounded-lg p-4">
            <h3 className="text-foreground text-sm font-medium">Slippage Protection</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Set your slippage tolerance to protect against price movements during the swap. Higher
              slippage allows for faster execution but may result in less favorable rates.
            </p>
          </div>
        </div>
      </div>
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
