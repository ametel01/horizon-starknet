'use client';

import type { MarketData } from '@entities/market';
import { AddLiquidityForm, RemoveLiquidityForm } from '@features/liquidity';
import { useDashboardMarkets } from '@features/markets';
import { useTokenBalance } from '@features/portfolio';
import { useStarknet } from '@features/wallet';
import { ApyBreakdown, useApyBreakdown } from '@features/yield';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@shared/ui/tabs';
import BigNumber from 'bignumber.js';
import {
  AlertTriangle,
  BookOpen,
  Droplets,
  Info,
  PiggyBank,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

type PoolTab = 'add' | 'remove';

/**
 * Calculate user's share of pool reserves.
 * Extracted to reduce component complexity.
 */
function calculateUserReserves(
  lpBalance: bigint | undefined,
  market: { state: { syReserve: bigint; ptReserve: bigint; totalLpSupply: bigint } } | undefined
): { sy: bigint; pt: bigint } {
  if (lpBalance === undefined || market === undefined || market.state.totalLpSupply === 0n) {
    return { sy: 0n, pt: 0n };
  }
  const { syReserve, ptReserve, totalLpSupply } = market.state;
  return {
    sy: (lpBalance * syReserve) / totalLpSupply,
    pt: (lpBalance * ptReserve) / totalLpSupply,
  };
}

/**
 * Calculate user's share of pool as percentage.
 */
function calculatePoolSharePercent(
  lpBalance: bigint | undefined,
  totalLpSupply: bigint | undefined
): BigNumber {
  if (lpBalance === undefined || totalLpSupply === undefined || totalLpSupply === 0n) {
    return new BigNumber(0);
  }
  return new BigNumber(lpBalance.toString()).dividedBy(totalLpSupply.toString()).multipliedBy(100);
}

/**
 * Select market based on URL param or default to first.
 */
function selectMarketByParam<T extends { address: string }>(
  markets: T[],
  param: string | null
): T | undefined {
  if (param) {
    return markets.find((m) => m.address === param);
  }
  return markets[0];
}

/**
 * User LP position display content - extracted to reduce main component complexity.
 */
interface UserPositionContentProps {
  lpBalanceLoading: boolean;
  lpBalance: bigint | undefined;
  userPoolShare: BigNumber;
  userReserves: { sy: bigint; pt: bigint };
}

function UserPositionContent({
  lpBalanceLoading,
  lpBalance,
  userPoolShare,
  userReserves,
}: UserPositionContentProps): ReactNode {
  if (lpBalanceLoading) {
    return (
      <div className="space-y-2">
        <div className="bg-muted h-6 w-32 animate-pulse rounded" />
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
      </div>
    );
  }
  if (lpBalance !== undefined && lpBalance > BigInt(0)) {
    return (
      <LpPositionDisplay
        lpBalance={lpBalance}
        userPoolShare={userPoolShare}
        userReserves={userReserves}
      />
    );
  }
  return <div className="text-muted-foreground">No LP position in this market</div>;
}

/**
 * State-based content resolver for the main form area.
 * Extracted to reduce complexity of the parent component.
 */
interface FormAreaProps {
  mounted: boolean;
  isLoading: boolean;
  isError: boolean;
  selectedMarket: MarketData | undefined;
  activeTab: PoolTab;
}

function FormAreaContent({
  mounted,
  isLoading,
  isError,
  selectedMarket,
  activeTab,
}: FormAreaProps): ReactNode {
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

  if (!selectedMarket) {
    return (
      <div className="border-border bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No markets available.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Markets will appear here once they are created.
        </p>
      </div>
    );
  }

  return activeTab === 'add' ? (
    <AddLiquidityForm market={selectedMarket} />
  ) : (
    <RemoveLiquidityForm market={selectedMarket} />
  );
}

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

/**
 * Component for displaying LP position details.
 * Extracted to reduce complexity of parent component.
 */
interface LpPositionDisplayProps {
  lpBalance: bigint;
  userPoolShare: BigNumber;
  userReserves: { sy: bigint; pt: bigint };
}

function LpPositionDisplay({
  lpBalance,
  userPoolShare,
  userReserves,
}: LpPositionDisplayProps): ReactNode {
  const formattedLp = formatWadCompact(lpBalance);

  // Check for effectively zero LP balance
  if (formattedLp === '0' || formattedLp === '< 0.01') {
    return <div className="text-muted-foreground">No significant LP position</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-foreground font-mono text-2xl font-semibold">{formattedLp} LP</div>
        <div className="text-muted-foreground text-sm">
          {userPoolShare.lt(0.01) ? '< 0.01' : userPoolShare.toFixed(2)}% of pool
        </div>
      </div>
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
          Your share of reserves
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">SY:</span>
          <span className="text-foreground font-mono">{formatWadCompact(userReserves.sy)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">PT:</span>
          <span className="text-foreground font-mono">{formatWadCompact(userReserves.pt)}</span>
        </div>
      </div>
      <div className="border-chart-2/30 bg-chart-2/10 rounded-lg border p-3">
        <div className="text-chart-2 flex items-center gap-1.5 text-xs font-medium">
          <TrendingUp className="h-3.5 w-3.5" />
          LP Rewards
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Swap fees auto-compound into your position, growing your share of reserves.
        </p>
      </div>
    </div>
  );
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
  const selectedMarket = useMemo(
    () => selectMarketByParam(markets, marketParam),
    [markets, marketParam]
  );

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
  const userPoolShare = useMemo(
    () => calculatePoolSharePercent(lpBalance, selectedMarket?.state.totalLpSupply),
    [lpBalance, selectedMarket]
  );

  // Calculate user's share of reserves
  const userReserves = useMemo(
    () => calculateUserReserves(lpBalance, selectedMarket),
    [lpBalance, selectedMarket]
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Main Content */}
        <div>
          {selectedMarket && mounted && !isLoading && !isError ? (
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
                <FormAreaContent
                  mounted={mounted}
                  isLoading={false}
                  isError={false}
                  selectedMarket={selectedMarket}
                  activeTab={activeTab}
                />
              </Tabs>
            </div>
          ) : (
            <FormAreaContent
              mounted={mounted}
              isLoading={isLoading}
              isError={isError}
              selectedMarket={selectedMarket}
              activeTab={activeTab}
            />
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* User's LP Position */}
          {isConnected && selectedMarket && (
            <div
              className={cn(
                'border-border/50 bg-card overflow-hidden rounded-xl border',
                'translate-y-2 opacity-0',
                mounted && 'translate-y-0 opacity-100',
                'transition-all duration-300'
              )}
            >
              <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
                <Wallet className="text-primary h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">Your Position</h3>
              </div>
              <div className="p-4">
                <UserPositionContent
                  lpBalanceLoading={lpBalanceLoading}
                  lpBalance={lpBalance}
                  userPoolShare={userPoolShare}
                  userReserves={userReserves}
                />
              </div>
            </div>
          )}

          {/* LP APY Breakdown */}
          {selectedMarket !== undefined && apyBreakdown !== null && (
            <ApyBreakdown breakdown={apyBreakdown} view="lp" title="LP Yield Breakdown" />
          )}

          {/* Pool Info */}
          {selectedMarket && (
            <div
              className={cn(
                'border-border/50 bg-card overflow-hidden rounded-xl border',
                'translate-y-2 opacity-0',
                mounted && 'translate-y-0 opacity-100',
                'transition-all delay-75 duration-300'
              )}
            >
              <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
                <PiggyBank className="text-muted-foreground h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">
                  {getPoolName(selectedMarket)} Statistics
                </h3>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Liquidity</span>
                  <span className="text-foreground font-mono">
                    {formatWadCompact(selectedMarket.state.totalLpSupply)} LP
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SY Reserve</span>
                  <span className="text-foreground font-mono">
                    {formatWadCompact(selectedMarket.state.syReserve)} SY-
                    {getPoolSymbol(selectedMarket)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PT Reserve</span>
                  <span className="text-foreground font-mono">
                    {formatWadCompact(selectedMarket.state.ptReserve)} PT-
                    {getPoolSymbol(selectedMarket)}
                  </span>
                </div>
                <div className="border-border/50 border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Implied APY</span>
                    <span className="text-primary font-mono font-medium">
                      {selectedMarket.impliedApy.multipliedBy(100).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days to Expiry</span>
                  <span className="text-foreground font-mono">
                    {Math.round(selectedMarket.daysToExpiry)}
                  </span>
                </div>
                {selectedMarket.state.feesCollected > 0n && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Protocol Fees Collected</span>
                    <span className="text-foreground font-mono">
                      {formatWadCompact(selectedMarket.state.feesCollected)} SY
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* How Liquidity Works */}
          {selectedMarket && (
            <div
              className={cn(
                'border-border/50 bg-card overflow-hidden rounded-xl border',
                'translate-y-2 opacity-0',
                mounted && 'translate-y-0 opacity-100',
                'transition-all delay-150 duration-300'
              )}
            >
              <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
                <Info className="text-muted-foreground h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">How Liquidity Works</h3>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-primary/20 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
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
                    <div className="bg-primary/20 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
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
                    <div className="bg-primary/20 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
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
                    <div className="bg-chart-1/20 text-chart-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <AlertTriangle className="h-4 w-4" />
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
                <div className="border-border/50 border-t pt-4">
                  <Link
                    href="/docs"
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PoolsPage(): ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
            <Droplets className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Liquidity Pools</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Provide liquidity to earn trading fees from PT/SY swaps
            </p>
          </div>
        </div>
      </header>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[600px] max-w-lg" />}>
        <PoolsPageContent />
      </Suspense>
    </div>
  );
}
