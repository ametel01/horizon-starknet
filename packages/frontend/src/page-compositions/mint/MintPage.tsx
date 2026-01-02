'use client';

import { SimpleEarnForm, SimpleWithdrawForm, WrapToSyForm } from '@features/earn';
import { useDashboardMarkets } from '@features/markets';
import { MintForm } from '@features/mint';
import { UnwrapSyForm } from '@features/redeem';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { AlertCircle, BookOpen, Coins, Info, Layers } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useMemo, useState } from 'react';

type TabType = 'wrap' | 'split' | 'unwrap';
type SimpleTabType = 'earn' | 'withdraw';

/**
 * Simple mode content - streamlined deposit/withdraw flow
 */
function SimpleModeContent(): ReactNode {
  const searchParams = useSearchParams();
  const marketParam = searchParams.get('market');
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<SimpleTabType>('earn');
  const [selectedMarketAddress, setSelectedMarketAddress] = useState<string | null>(marketParam);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { markets, isLoading, isError } = useDashboardMarkets();

  const selectedMarket = useMemo(() => {
    if (selectedMarketAddress) {
      return markets.find((m) => m.address === selectedMarketAddress);
    }
    if (marketParam) {
      return markets.find((m) => m.address === marketParam);
    }
    return markets[0];
  }, [markets, marketParam, selectedMarketAddress]);

  useEffect(() => {
    if (markets.length > 0 && !selectedMarketAddress && !marketParam) {
      setSelectedMarketAddress(markets[0]?.address ?? null);
    }
  }, [markets, selectedMarketAddress, marketParam]);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form Section */}
        <div>
          {/* Market Selector */}
          <div className="mb-4">
            <label className="text-foreground mb-2 block text-sm font-medium">Select Asset</label>
            <Select
              value={selectedMarket?.address ?? ''}
              onValueChange={(value) => {
                setSelectedMarketAddress(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedMarket
                    ? `${selectedMarket.metadata?.yieldTokenSymbol ?? selectedMarket.address.slice(0, 10)} - ${selectedMarket.metadata?.yieldTokenName ?? 'Unknown'} (${selectedMarket.impliedApy.multipliedBy(100).toFixed(1)}% APY)`
                    : 'Select an asset'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {markets.map((m) => (
                  <SelectItem key={m.address} value={m.address}>
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {m.metadata?.yieldTokenSymbol ?? m.address.slice(0, 10)} -{' '}
                        {m.metadata?.yieldTokenName ?? 'Unknown'}
                      </span>
                      <span className="text-primary font-mono text-sm">
                        {m.impliedApy.multipliedBy(100).toFixed(1)}%
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Simple Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as SimpleTabType);
            }}
            className="space-y-4"
          >
            <TabsList className="w-full">
              <TabsTrigger value="earn" className="flex-1">
                Deposit
              </TabsTrigger>
              <TabsTrigger
                value="withdraw"
                className="data-active:bg-chart-1 data-active:text-foreground flex-1"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>

            {/* Form */}
            {!mounted || isLoading ? (
              <SkeletonCard className="h-[500px]" />
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
            ) : activeTab === 'earn' ? (
              <SimpleEarnForm market={selectedMarket} />
            ) : (
              <SimpleWithdrawForm market={selectedMarket} />
            )}
          </Tabs>
        </div>

        {/* Info Panel - Simplified */}
        <div
          className={cn(
            'border-border/50 bg-card overflow-hidden rounded-xl border',
            'translate-y-2 opacity-0',
            mounted && 'translate-y-0 opacity-100',
            'transition-all delay-75 duration-300'
          )}
        >
          <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
            <BookOpen
              className={activeTab === 'withdraw' ? 'text-chart-1 h-4 w-4' : 'text-primary h-4 w-4'}
            />
            <h2 className="text-foreground text-sm font-semibold">
              {activeTab === 'withdraw' ? 'How Withdrawing Works' : 'How Earning Works'}
            </h2>
          </div>

          <div className="p-4">
            {activeTab === 'withdraw' ? (
              <div className="text-muted-foreground space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="bg-chart-1/20 text-chart-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    1
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Select Amount</p>
                    <p className="mt-1">Choose how much of your position you want to withdraw.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-chart-1/20 text-chart-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    2
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Receive Tokens</p>
                    <p className="mt-1">
                      Your position is converted back to the original tokens in a single
                      transaction.
                    </p>
                  </div>
                </div>

                <div className="border-chart-1/30 bg-chart-1/10 flex items-start gap-2 rounded-lg border p-3">
                  <AlertCircle className="text-chart-1 mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-chart-1 text-sm">
                    Withdrawing before maturity requires equal Fixed-Rate and Variable-Rate
                    positions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    1
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Deposit Tokens</p>
                    <p className="mt-1">
                      Deposit your yield-bearing tokens (like sSTRK) into the protocol.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    2
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Receive Positions</p>
                    <p className="mt-1">
                      You receive a Fixed-Rate Position (guaranteed yield) and a Variable-Rate
                      Position (floating yield).
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    3
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Earn Yield</p>
                    <p className="mt-1">
                      Hold until maturity to earn the fixed rate, or withdraw anytime.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted/50 mt-4 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Info className="text-muted-foreground h-4 w-4" />
                <h3 className="text-foreground text-sm font-medium">Position Types</h3>
              </div>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Fixed-Rate</dt>
                  <dd className="text-foreground font-medium">Guaranteed yield at maturity</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Variable-Rate</dt>
                  <dd className="text-foreground font-medium">Floating yield until maturity</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Advanced mode content - original tabbed interface
 */
function AdvancedModeContent(): ReactNode {
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

  const selectedMarket = useMemo(() => {
    if (selectedMarketAddress) {
      return markets.find((m) => m.address === selectedMarketAddress);
    }
    if (marketParam) {
      return markets.find((m) => m.address === marketParam);
    }
    return markets[0];
  }, [markets, marketParam, selectedMarketAddress]);

  useEffect(() => {
    if (markets.length > 0 && !selectedMarketAddress && !marketParam) {
      setSelectedMarketAddress(markets[0]?.address ?? null);
    }
  }, [markets, selectedMarketAddress, marketParam]);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form Section */}
        <div>
          {/* Market Selector */}
          <div className="mb-4">
            <label className="text-foreground mb-2 block text-sm font-medium">Select Asset</label>
            <Select
              value={selectedMarket?.address ?? ''}
              onValueChange={(value) => {
                setSelectedMarketAddress(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedMarket
                    ? `${selectedMarket.metadata?.yieldTokenSymbol ?? selectedMarket.address.slice(0, 10)} - ${selectedMarket.metadata?.yieldTokenName ?? 'Unknown'} (${selectedMarket.impliedApy.multipliedBy(100).toFixed(1)}% APY)`
                    : 'Select an asset'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {markets.map((m) => (
                  <SelectItem key={m.address} value={m.address}>
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {m.metadata?.yieldTokenSymbol ?? m.address.slice(0, 10)} -{' '}
                        {m.metadata?.yieldTokenName ?? 'Unknown'}
                      </span>
                      <span className="text-primary font-mono text-sm">
                        {m.impliedApy.multipliedBy(100).toFixed(1)}%
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as TabType);
            }}
            className="space-y-4"
          >
            <TabsList className="w-full">
              <TabsTrigger value="wrap" className="flex-1">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="split" className="flex-1">
                Split
              </TabsTrigger>
              <TabsTrigger
                value="unwrap"
                className="data-active:bg-chart-1 data-active:text-foreground flex-1"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>

            {/* Form */}
            {!mounted || isLoading ? (
              <SkeletonCard className="h-[500px]" />
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
            ) : activeTab === 'wrap' ? (
              <WrapToSyForm market={selectedMarket} />
            ) : activeTab === 'split' ? (
              <MintForm market={selectedMarket} />
            ) : (
              <UnwrapSyForm market={selectedMarket} />
            )}
          </Tabs>
        </div>

        {/* Info Panel */}
        <div
          className={cn(
            'border-border/50 bg-card overflow-hidden rounded-xl border',
            'translate-y-2 opacity-0',
            mounted && 'translate-y-0 opacity-100',
            'transition-all delay-75 duration-300'
          )}
        >
          <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
            <BookOpen
              className={activeTab === 'unwrap' ? 'text-chart-1 h-4 w-4' : 'text-primary h-4 w-4'}
            />
            <h2 className="text-foreground text-sm font-semibold">
              {activeTab === 'unwrap' ? 'How Withdrawing Works' : 'How Splitting Works'}
            </h2>
          </div>

          <div className="p-4">
            {activeTab === 'unwrap' ? (
              <div className="text-muted-foreground space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="bg-chart-1/20 text-chart-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    1
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Withdraw Your Tokens</p>
                    <p className="mt-1">
                      Convert your deposited tokens back to the underlying yield-bearing token (like
                      sSTRK).
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-chart-1/20 text-chart-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    2
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Continue Earning</p>
                    <p className="mt-1">
                      Your yield-bearing tokens will continue earning yield in your wallet or can be
                      used in other DeFi protocols.
                    </p>
                  </div>
                </div>

                <div className="border-chart-1/30 bg-chart-1/10 flex items-start gap-2 rounded-lg border p-3">
                  <AlertCircle className="text-chart-1 mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-chart-1 text-sm">
                    This only converts SY tokens back to the underlying token. If you have PT or YT,
                    use Redeem in Portfolio to convert them to SY first.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-4 text-sm">
                <div className="flex gap-3">
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium',
                      activeTab === 'wrap'
                        ? 'bg-primary/30 text-primary'
                        : 'bg-primary/20 text-primary'
                    )}
                  >
                    1
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Deposit Tokens</p>
                    <p className="mt-1">
                      Deposit your yield-bearing tokens (like sSTRK) into the protocol.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium',
                      activeTab === 'split'
                        ? 'bg-primary/30 text-primary'
                        : 'bg-primary/20 text-primary'
                    )}
                  >
                    2
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Split into PT + YT</p>
                    <p className="mt-1">
                      For each token deposited, you receive 1 Principal Token (PT) and 1 Yield Token
                      (YT).
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                    3
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Use Your Tokens</p>
                    <p className="mt-1">
                      PT can be traded or held until maturity. YT earns yield until expiry.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted/50 mt-4 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Layers className="text-muted-foreground h-4 w-4" />
                <h3 className="text-foreground text-sm font-medium">Token Details</h3>
              </div>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">PT (Principal Token)</dt>
                  <dd className="text-foreground font-medium">Redeemable at maturity</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">YT (Yield Token)</dt>
                  <dd className="text-foreground font-medium">Earns yield until expiry</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MintPageContent(): ReactNode {
  const { isSimple } = useUIMode();

  return isSimple ? <SimpleModeContent /> : <AdvancedModeContent />;
}

export function MintPage(): ReactNode {
  const { isSimple } = useUIMode();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
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
            <Coins className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
              {isSimple ? 'Earn Fixed Yield' : 'Deposit & Split'}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {isSimple
                ? 'Deposit tokens to earn a guaranteed fixed rate'
                : 'Split yield-bearing tokens into PT and YT'}
            </p>
          </div>
        </div>
      </header>

      {/* Content wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<SkeletonCard className="h-[500px] max-w-lg" />}>
        <MintPageContent />
      </Suspense>
    </div>
  );
}
