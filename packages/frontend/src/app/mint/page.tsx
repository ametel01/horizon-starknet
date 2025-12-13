'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useMemo, useState } from 'react';

import { MintForm } from '@/components/forms/MintForm';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';

function MintPageContent(): ReactNode {
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
      {/* Mint Form */}
      <div className="w-full max-w-lg">
        {!mounted || isLoading ? (
          <SkeletonCard className="h-[500px]" />
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
          <MintForm market={selectedMarket} />
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 w-full max-w-md lg:mt-0">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold text-neutral-100">How Minting Works</h2>
          <div className="mt-4 space-y-4 text-sm text-neutral-400">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                1
              </div>
              <div>
                <p className="font-medium text-neutral-200">Deposit SY Tokens</p>
                <p className="mt-1">
                  SY (Standardized Yield) tokens represent yield-bearing assets like staked tokens.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                2
              </div>
              <div>
                <p className="font-medium text-neutral-200">Receive PT + YT</p>
                <p className="mt-1">
                  For each SY deposited, you receive 1 Principal Token (PT) and 1 Yield Token (YT).
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-500">
                3
              </div>
              <div>
                <p className="font-medium text-neutral-200">Use Your Tokens</p>
                <p className="mt-1">
                  PT can be traded or held until maturity. YT earns yield until expiry.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-neutral-800/50 p-4">
            <h3 className="text-sm font-medium text-neutral-200">Token Details</h3>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-400">PT (Principal Token)</dt>
                <dd className="text-neutral-200">Redeemable for 1 SY at maturity</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-400">YT (Yield Token)</dt>
                <dd className="text-neutral-200">Earns yield until expiry</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MintPage(): ReactNode {
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
        <h1 className="text-3xl font-bold text-neutral-100">Mint Tokens</h1>
        <p className="mt-2 text-neutral-400">
          Deposit SY tokens to mint Principal Tokens (PT) and Yield Tokens (YT)
        </p>
      </div>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[500px] max-w-lg" />}>
        <MintPageContent />
      </Suspense>
    </div>
  );
}
