'use client';

import BigNumber from 'bignumber.js';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import { AddLiquidityForm, RemoveLiquidityForm } from '@features/liquidity';
import { useDashboardMarkets } from '@features/markets';
import { useTokenBalance } from '@features/portfolio';
import { useStarknet } from '@features/wallet';
import { useApyBreakdown, ApyBreakdown } from '@features/yield';
import { formatWadCompact } from '@shared/math/wad';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@shared/ui/tabs';

type PoolTab = 'add' | 'remove';

// Helper to get pool display name
function getPoolName(market: MarketData): string {
  if (market.metadata) {
    return `${market.metadata.yieldTokenSymbol} Pool`;
  }
  // Fallback to truncated address
  return `${market.address.slice(0, 6)}...${market.address.slice(-4)}`;
}

// Helper to get pool symbol
function getPoolSymbol(market: MarketData): string {
  return market.metadata?.yieldTokenSymbol ?? market.address.slice(0, 8);
}

function PoolsPageContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketParam = searchParams.get('market');
  const [activeTab, setActiveTab] = useState<PoolTab>('add');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { markets, isLoading, isError } = useDashboardMarkets();
  const { isConnected } = useStarknet();

  // Select market based on URL param or default to first market
  const selectedMarket = useMemo(() => {
    if (marketParam) {
      return markets.find((m) => m.address === marketParam);
    }
    return markets[0];
  }, [markets, marketParam]);

  // Handle market selection change
  const handleMarketChange = useCallback(
    (marketAddress: string) => {
      router.push(`/pools?market=${marketAddress}`);
    },
    [router]
  );

  // Fetch LP balance for selected market
  const { data: lpBalance, isLoading: lpBalanceLoading } = useTokenBalance(
    selectedMarket?.address ?? null
  );

  // Fetch APY breakdown for the selected market
  const { data: apyBreakdown } = useApyBreakdown(selectedMarket);

  // Calculate user's share of pool
  const userPoolShare = useMemo(() => {
    if (
      selectedMarket === undefined ||
      lpBalance === undefined ||
      selectedMarket.state.totalLpSupply === BigInt(0)
    ) {
      return new BigNumber(0);
    }
    return new BigNumber(lpBalance.toString())
      .dividedBy(selectedMarket.state.totalLpSupply.toString())
      .multipliedBy(100);
  }, [lpBalance, selectedMarket]);

  // Calculate user's share of reserves
  const userReserves = useMemo(() => {
    if (
      selectedMarket === undefined ||
      lpBalance === undefined ||
      selectedMarket.state.totalLpSupply === BigInt(0)
    ) {
      return { sy: BigInt(0), pt: BigInt(0) };
    }
    const { syReserve, ptReserve, totalLpSupply } = selectedMarket.state;
    return {
      sy: (lpBalance * syReserve) / totalLpSupply,
      pt: (lpBalance * ptReserve) / totalLpSupply,
    };
  }, [lpBalance, selectedMarket]);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Main Content */}
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
              {/* Pool Selector */}
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Select Pool
                </label>
                <Select
                  value={selectedMarket.address}
                  onValueChange={(value) => {
                    if (value) handleMarketChange(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {getPoolSymbol(selectedMarket)} Pool -{' '}
                      {selectedMarket.metadata?.yieldTokenName ?? 'Unknown'} (
                      {selectedMarket.impliedApy.multipliedBy(100).toFixed(1)}% APY)
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map((market) => (
                      <SelectItem key={market.address} value={market.address}>
                        <div className="flex items-center justify-between gap-4">
                          <span>
                            {getPoolSymbol(market)} Pool -{' '}
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

              {/* Add/Remove Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  setActiveTab(value as PoolTab);
                }}
                className="space-y-4"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="add" className="flex-1">
                    Add Liquidity
                  </TabsTrigger>
                  <TabsTrigger value="remove" className="flex-1">
                    Remove Liquidity
                  </TabsTrigger>
                </TabsList>

                {/* Form */}
                {activeTab === 'add' ? (
                  <AddLiquidityForm market={selectedMarket} />
                ) : (
                  <RemoveLiquidityForm market={selectedMarket} />
                )}
              </Tabs>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* User's LP Position */}
          {isConnected && selectedMarket && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Position</CardTitle>
              </CardHeader>
              <CardContent>
                {lpBalanceLoading ? (
                  <div className="space-y-2">
                    <div className="bg-muted h-6 w-32 animate-pulse rounded" />
                    <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                  </div>
                ) : lpBalance !== undefined && lpBalance > BigInt(0) ? (
                  (() => {
                    const formattedLp = formatWadCompact(lpBalance);
                    // If LP balance is effectively zero, show "no position"
                    if (formattedLp === '0' || formattedLp === '< 0.01') {
                      return (
                        <div className="text-muted-foreground">No significant LP position</div>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        <div>
                          <div className="text-foreground text-2xl font-semibold">
                            {formattedLp} LP
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {userPoolShare.lt(0.01) ? '< 0.01' : userPoolShare.toFixed(2)}% of pool
                          </div>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="text-muted-foreground mb-1 text-xs">
                            Your share of reserves
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">SY:</span>
                            <span className="text-foreground">
                              {formatWadCompact(userReserves.sy)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">PT:</span>
                            <span className="text-foreground">
                              {formatWadCompact(userReserves.pt)}
                            </span>
                          </div>
                        </div>
                        <div className="border-chart-2/30 bg-chart-2/10 rounded-lg border p-3">
                          <div className="text-chart-2 flex items-center gap-1.5 text-xs font-medium">
                            <svg
                              className="h-3.5 w-3.5"
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
                            LP Rewards
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Swap fees auto-compound into your position, growing your share of
                            reserves.
                          </p>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-muted-foreground">No LP position in this market</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* LP APY Breakdown */}
          {selectedMarket !== undefined && apyBreakdown !== null && (
            <ApyBreakdown breakdown={apyBreakdown} view="lp" title="LP Yield Breakdown" />
          )}

          {/* Pool Info */}
          {selectedMarket && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {getPoolName(selectedMarket)} Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Liquidity</span>
                  <span className="text-foreground">
                    {formatWadCompact(selectedMarket.state.totalLpSupply)} LP
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SY Reserve</span>
                  <span className="text-foreground">
                    {formatWadCompact(selectedMarket.state.syReserve)} SY-
                    {getPoolSymbol(selectedMarket)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PT Reserve</span>
                  <span className="text-foreground">
                    {formatWadCompact(selectedMarket.state.ptReserve)} PT-
                    {getPoolSymbol(selectedMarket)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Implied APY</span>
                  <span className="text-primary font-medium">
                    {selectedMarket.impliedApy.multipliedBy(100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days to Expiry</span>
                  <span className="text-foreground">{Math.round(selectedMarket.daysToExpiry)}</span>
                </div>
                {selectedMarket.state.feesCollected > 0n && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protocol Fees Collected</span>
                    <span className="text-foreground">
                      {formatWadCompact(selectedMarket.state.feesCollected)} SY
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* How Liquidity Works */}
          {selectedMarket && (
            <div className="border-border bg-card rounded-lg border p-4">
              <h3 className="text-foreground mb-3 text-sm font-semibold">How Liquidity Works</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    1
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">Provide SY + PT</p>
                    <p className="text-muted-foreground text-xs">
                      Deposit both tokens in pool ratio for LP tokens.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    2
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">Earn Trading Fees</p>
                    <p className="text-muted-foreground text-xs">
                      LP tokens earn fees from every swap.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    3
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">Withdraw Anytime</p>
                    <p className="text-muted-foreground text-xs">
                      Remove liquidity for your share of reserves.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-chart-1/20 text-chart-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    !
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">Impermanent Loss</p>
                    <p className="text-muted-foreground text-xs">
                      PT price converges to 1 SY at maturity.
                    </p>
                  </div>
                </div>
              </div>

              {/* Learn More Link */}
              <div className="border-border mt-4 border-t pt-4">
                <Link
                  href="/docs"
                  className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium"
                >
                  Learn more about liquidity provision
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
    </div>
  );
}

export function PoolsPage(): ReactNode {
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
        <h1 className="text-foreground text-3xl font-bold">Liquidity Pools</h1>
        <p className="text-muted-foreground mt-2">
          Provide liquidity to earn trading fees from PT/SY swaps
        </p>
      </div>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[600px] max-w-lg" />}>
        <PoolsPageContent />
      </Suspense>
    </div>
  );
}
