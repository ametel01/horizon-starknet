'use client';

import BigNumber from 'bignumber.js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useMemo, useState } from 'react';

import { AddLiquidityForm } from '@/components/forms/AddLiquidityForm';
import { RemoveLiquidityForm } from '@/components/forms/RemoveLiquidityForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { useStarknet } from '@/hooks/useStarknet';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWad } from '@/lib/math/wad';

type PoolTab = 'add' | 'remove';

function PoolsPageContent(): ReactNode {
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
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-8 text-center">
            <p className="text-red-500">Failed to load markets. Please try again.</p>
          </div>
        ) : !selectedMarket ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
            <p className="text-neutral-400">No markets available.</p>
            <p className="mt-2 text-sm text-neutral-500">
              Markets will appear here once they are created.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(): void => {
                  setActiveTab('add');
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'add'
                    ? 'bg-blue-500 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Add Liquidity
              </button>
              <button
                type="button"
                onClick={(): void => {
                  setActiveTab('remove');
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'remove'
                    ? 'bg-blue-500 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Remove Liquidity
              </button>
            </div>

            {/* Form */}
            {activeTab === 'add' ? (
              <AddLiquidityForm market={selectedMarket} />
            ) : (
              <RemoveLiquidityForm market={selectedMarket} />
            )}
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
                  <div className="h-6 w-32 animate-pulse rounded bg-neutral-800" />
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-800" />
                </div>
              ) : lpBalance !== undefined && lpBalance > BigInt(0) ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-semibold text-neutral-100">
                      {formatWad(lpBalance, 6)} LP
                    </div>
                    <div className="text-sm text-neutral-400">
                      {userPoolShare.toFixed(4)}% of pool
                    </div>
                  </div>
                  <div className="rounded-lg bg-neutral-800/50 p-3">
                    <div className="mb-1 text-xs text-neutral-500">Your share of reserves</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">SY:</span>
                      <span className="text-neutral-200">{formatWad(userReserves.sy, 4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">PT:</span>
                      <span className="text-neutral-200">{formatWad(userReserves.pt, 4)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-neutral-500">No LP position in this market</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pool Info */}
        {selectedMarket && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Pool Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Liquidity</span>
                <span className="text-neutral-200">
                  {formatWad(selectedMarket.state.totalLpSupply, 4)} LP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">SY Reserve</span>
                <span className="text-neutral-200">
                  {formatWad(selectedMarket.state.syReserve, 4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">PT Reserve</span>
                <span className="text-neutral-200">
                  {formatWad(selectedMarket.state.ptReserve, 4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Implied APY</span>
                <span className="font-medium text-green-500">
                  {selectedMarket.impliedApy.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Days to Expiry</span>
                <span className="text-neutral-200">{selectedMarket.daysToExpiry.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Panel */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold text-neutral-100">How Liquidity Works</h2>
          <div className="mt-4 space-y-4 text-sm text-neutral-400">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                1
              </div>
              <div>
                <p className="font-medium text-neutral-200">Provide SY + PT</p>
                <p className="mt-1">
                  Deposit both SY and PT tokens in the current pool ratio to receive LP tokens.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                2
              </div>
              <div>
                <p className="font-medium text-neutral-200">Earn Trading Fees</p>
                <p className="mt-1">
                  LP tokens represent your share of the pool. You earn fees from every swap.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                3
              </div>
              <div>
                <p className="font-medium text-neutral-200">Withdraw Anytime</p>
                <p className="mt-1">
                  Remove liquidity to receive your proportional share of SY and PT from the pool.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-neutral-800/50 p-4">
            <h3 className="text-sm font-medium text-neutral-200">Impermanent Loss</h3>
            <p className="mt-2 text-sm text-neutral-400">
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
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
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
        <h1 className="text-3xl font-bold text-neutral-100">Liquidity Pools</h1>
        <p className="mt-2 text-neutral-400">
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
