'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useMemo, useState } from 'react';

import { SwapForm } from '@/components/forms/SwapForm';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';

function TradePageContent(): ReactNode {
  const searchParams = useSearchParams();
  const marketParam = searchParams.get('market');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { markets, isLoading, isError } = useDashboardMarkets();

  // Select market based on URL param or default to first market
  const selectedMarket = useMemo(() => {
    if (marketParam) {
      return markets.find((m) => m.address === marketParam);
    }
    return markets[0];
  }, [markets, marketParam]);

  return (
    <div className="flex flex-col items-center lg:flex-row lg:items-start lg:gap-8">
      {/* Swap Form */}
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
          <SwapForm market={selectedMarket} />
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 w-full max-w-md lg:mt-0">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold text-neutral-100">How Trading Works</h2>
          <div className="mt-4 space-y-4 text-sm text-neutral-400">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                PT
              </div>
              <div>
                <p className="font-medium text-neutral-200">Principal Token (PT)</p>
                <p className="mt-1">
                  Buy PT at a discount for fixed yield. PT redeems for the underlying token at
                  expiry. PT price rises when rates fall and falls when rates rise.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-xs font-medium text-green-500">
                YT
              </div>
              <div>
                <p className="font-medium text-neutral-200">Yield Token (YT)</p>
                <p className="mt-1">
                  Buy YT to speculate on rising yields. YT gives you the right to claim all yield
                  until expiry. YT expires worthless but can be very profitable if yields are high.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-medium text-purple-500">
                $
              </div>
              <div>
                <p className="font-medium text-neutral-200">Trading Strategies</p>
                <p className="mt-1">
                  <span className="text-neutral-300">Fixed Yield:</span> Buy PT, hold to expiry.
                  <br />
                  <span className="text-neutral-300">Yield Bull:</span> Buy YT, profit if yields
                  exceed implied APY.
                  <br />
                  <span className="text-neutral-300">Yield Bear:</span> Sell YT, profit if yields
                  stay low.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-neutral-800/50 p-4">
            <h3 className="text-sm font-medium text-neutral-200">Implied Yield</h3>
            <p className="mt-2 text-sm text-neutral-400">
              The implied yield is derived from the PT price. Buying PT at a lower price means a
              higher implied yield for your investment.
            </p>
            {selectedMarket && (
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-neutral-400">Current Implied APY:</span>
                <span className="font-medium text-green-500">
                  {selectedMarket.impliedApy.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-neutral-800/50 p-4">
            <h3 className="text-sm font-medium text-neutral-200">Slippage Protection</h3>
            <p className="mt-2 text-sm text-neutral-400">
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
        <h1 className="text-3xl font-bold text-neutral-100">Trade</h1>
        <p className="mt-2 text-neutral-400">
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
