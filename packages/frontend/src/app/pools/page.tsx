'use client';

import BigNumber from 'bignumber.js';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { AddLiquidityForm } from '@/components/forms/AddLiquidityForm';
import { RemoveLiquidityForm } from '@/components/forms/RemoveLiquidityForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { useStarknet } from '@/hooks/useStarknet';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWadCompact } from '@/lib/math/wad';
import type { MarketData } from '@/types/market';

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
    <div className="flex flex-col items-center lg:flex-row lg:items-start lg:gap-8">
      {/* Main Content */}
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
            {/* Pool Selector */}
            <Card>
              <CardContent className="pt-4">
                <label className="text-muted-foreground mb-2 block text-sm font-medium">
                  Select Pool
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
                      <span className="font-medium">{getPoolSymbol(market)}</span>
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
      <div className="mt-8 w-full max-w-md lg:mt-0">
        {/* User's LP Position */}
        {isConnected && selectedMarket && (
          <Card className="mb-4">
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
                    return <div className="text-muted-foreground">No significant LP position</div>;
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

        {/* Pool Info */}
        {selectedMarket && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">{getPoolName(selectedMarket)} Statistics</CardTitle>
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
                <span className="text-foreground">{Math.ceil(selectedMarket.daysToExpiry)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Panel */}
        <div className="border-border bg-card rounded-lg border p-6">
          <h2 className="text-foreground text-lg font-semibold">How Liquidity Works</h2>
          <div className="text-muted-foreground mt-4 space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                1
              </div>
              <div>
                <p className="text-foreground font-medium">Provide SY + PT</p>
                <p className="mt-1">
                  Deposit both SY and PT tokens in the current pool ratio to receive LP tokens.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                2
              </div>
              <div>
                <p className="text-foreground font-medium">Earn Trading Fees</p>
                <p className="mt-1">
                  LP tokens represent your share of the pool. You earn fees from every swap.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                3
              </div>
              <div>
                <p className="text-foreground font-medium">Withdraw Anytime</p>
                <p className="mt-1">
                  Remove liquidity to receive your proportional share of SY and PT from the pool.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted mt-6 rounded-lg p-4">
            <h3 className="text-foreground text-sm font-medium">Impermanent Loss</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              As PT approaches maturity, its price converges to 1 SY. This natural price movement
              can result in impermanent loss for LPs, especially for pools with longer time to
              expiry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PoolsPage(): ReactNode {
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
