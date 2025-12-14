'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useMemo, useState } from 'react';

import { MintForm } from '@/components/forms/MintForm';
import { UnwrapSyForm } from '@/components/forms/UnwrapSyForm';
import { WrapToSyForm } from '@/components/forms/WrapToSyForm';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';

type TabType = 'wrap' | 'split' | 'unwrap';

function MintPageContent(): ReactNode {
  const searchParams = useSearchParams();
  const marketParam = searchParams.get('market');
  const tabParam = searchParams.get('tab');
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === 'split' ? 'split' : tabParam === 'unwrap' ? 'unwrap' : 'wrap'
  );
  const [selectedMarketAddress, setSelectedMarketAddress] = useState<string | null>(marketParam);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { markets, isLoading, isError } = useDashboardMarkets();

  // Select market based on state or URL param or default to first market
  const selectedMarket = useMemo(() => {
    if (selectedMarketAddress) {
      return markets.find((m) => m.address === selectedMarketAddress);
    }
    if (marketParam) {
      return markets.find((m) => m.address === marketParam);
    }
    return markets[0];
  }, [markets, marketParam, selectedMarketAddress]);

  // Update selected market address when markets load and no selection
  useEffect(() => {
    if (markets.length > 0 && !selectedMarketAddress && !marketParam) {
      setSelectedMarketAddress(markets[0]?.address ?? null);
    }
  }, [markets, selectedMarketAddress, marketParam]);

  return (
    <div className="flex flex-col items-center lg:flex-row lg:items-start lg:gap-8">
      {/* Form Section */}
      <div className="w-full max-w-lg">
        {/* Market Selector */}
        {markets.length > 1 && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-neutral-300">Select Asset</label>
            <select
              value={selectedMarket?.address ?? ''}
              onChange={(e) => {
                setSelectedMarketAddress(e.target.value);
              }}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {markets.map((m) => (
                <option key={m.address} value={m.address}>
                  {m.metadata?.yieldTokenSymbol ?? m.address.slice(0, 10)} -{' '}
                  {m.metadata?.yieldTokenName ?? 'Unknown'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex rounded-lg border border-neutral-800 bg-neutral-900 p-1">
          <button
            onClick={() => {
              setActiveTab('wrap');
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'wrap'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => {
              setActiveTab('split');
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'split'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Split
          </button>
          <button
            onClick={() => {
              setActiveTab('unwrap');
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'unwrap'
                ? 'bg-orange-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Withdraw
          </button>
        </div>

        {/* Form */}
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
        ) : activeTab === 'wrap' ? (
          <WrapToSyForm market={selectedMarket} />
        ) : activeTab === 'split' ? (
          <MintForm market={selectedMarket} />
        ) : (
          <UnwrapSyForm market={selectedMarket} />
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 w-full max-w-md lg:mt-0">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold text-neutral-100">
            {activeTab === 'unwrap' ? 'How Withdrawing Works' : 'How Splitting Works'}
          </h2>

          {activeTab === 'unwrap' ? (
            <div className="mt-4 space-y-4 text-sm text-neutral-400">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/30 text-xs font-medium text-orange-400">
                  1
                </div>
                <div>
                  <p className="font-medium text-neutral-200">Withdraw Your Tokens</p>
                  <p className="mt-1">
                    Convert your deposited tokens back to the underlying yield-bearing token (like
                    nstSTRK).
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-medium text-orange-500">
                  2
                </div>
                <div>
                  <p className="font-medium text-neutral-200">Continue Earning</p>
                  <p className="mt-1">
                    Your yield-bearing tokens will continue earning yield in your wallet or can be
                    used in other DeFi protocols.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-400">
                  <span className="font-medium">Note:</span> Withdrawing only converts deposited
                  tokens back. To convert PT+YT back, use the Redeem function in Portfolio.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-neutral-400">
              <div className="flex gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    activeTab === 'wrap'
                      ? 'bg-blue-500/30 text-blue-400'
                      : 'bg-blue-500/20 text-blue-500'
                  }`}
                >
                  1
                </div>
                <div>
                  <p className="font-medium text-neutral-200">Deposit Tokens</p>
                  <p className="mt-1">
                    Deposit your yield-bearing tokens (like nstSTRK) into the protocol.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    activeTab === 'split'
                      ? 'bg-blue-500/30 text-blue-400'
                      : 'bg-blue-500/20 text-blue-500'
                  }`}
                >
                  2
                </div>
                <div>
                  <p className="font-medium text-neutral-200">Split into PT + YT</p>
                  <p className="mt-1">
                    For each token deposited, you receive 1 Principal Token (PT) and 1 Yield Token
                    (YT).
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
          )}

          <div className="mt-6 rounded-lg bg-neutral-800/50 p-4">
            <h3 className="text-sm font-medium text-neutral-200">Token Details</h3>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-400">PT (Principal Token)</dt>
                <dd className="text-neutral-200">Redeemable for underlying at maturity</dd>
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
        <h1 className="text-3xl font-bold text-neutral-100">Deposit & Split</h1>
        <p className="mt-2 text-neutral-400">
          Deposit yield-bearing tokens, then split into Principal Tokens (PT) and Yield Tokens (YT)
        </p>
      </div>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[500px] max-w-lg" />}>
        <MintPageContent />
      </Suspense>
    </div>
  );
}
