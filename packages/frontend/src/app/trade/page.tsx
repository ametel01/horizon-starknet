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
          <SwapForm market={selectedMarket} />
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 w-full max-w-md lg:mt-0">
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
                  {selectedMarket.impliedApy.toFixed(2)}%
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
