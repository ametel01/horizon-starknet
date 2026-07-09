'use client';

import type { MarketData } from '@entities/market';
import { useProtocolStats } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useHydrated } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Button } from '@shared/ui/Button';
import { Skeleton } from '@shared/ui/Skeleton';
import { ArrowRight, BarChart3, Layers, LineChart, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useMemo } from 'react';

interface WorkbenchMetric {
  label: string;
  value: string;
  detail: string;
  state?: 'ok' | 'warning' | 'muted';
  loading?: boolean;
}

interface WorkbenchAction {
  label: string;
  description: string;
  href: string;
}

interface MarketSummary {
  avgApy: number;
  expiredCount: number;
  expiryDetail: string;
  focusDetail: string;
  focusTitle: string;
  oracleReadyCount: number;
  pricedAssetCount: number;
  spotOnlyCount: number;
  tvlUsd: number;
  tvlUsdAvailable: boolean;
}

interface MetricInputs {
  marketSummary: MarketSummary;
  markets: MarketData[];
  marketsError: boolean;
  pricesLoading: boolean;
  stats: {
    volume24h: bigint;
    swaps24h: number;
    fees24h: bigint;
  };
  statsError: boolean;
  statsLoading: boolean;
  isMarketPending: boolean;
  mounted: boolean;
}

const SIMPLE_ACTIONS: WorkbenchAction[] = [
  {
    label: 'Deposit for fixed yield',
    description: 'Choose an active market and mint Principal Tokens for a known maturity.',
    href: '/mint',
  },
  {
    label: 'Compare earning markets',
    description: 'Review live fixed-rate opportunities before committing capital.',
    href: '#markets',
  },
  {
    label: 'Review positions',
    description: 'Track maturities, withdrawals, and fixed-yield exposure.',
    href: '/portfolio',
  },
];

const ADVANCED_ACTIONS: WorkbenchAction[] = [
  {
    label: 'Mint PT + YT',
    description: 'Split supported yield assets into principal and yield exposure.',
    href: '/mint',
  },
  {
    label: 'Trade fixed rates',
    description: 'Buy or sell Principal Tokens against live AMM state.',
    href: '/trade',
  },
  {
    label: 'Manage liquidity',
    description: 'Route capital into PT/SY pools and monitor fee exposure.',
    href: '/pools',
  },
  {
    label: 'Review portfolio',
    description: 'Track PT, YT, and LP positions against maturity and yield claims.',
    href: '/portfolio',
  },
  {
    label: 'Inspect analytics',
    description: 'Open protocol charts, liquidity depth, and rate context.',
    href: '/analytics',
  },
];

export function HeroSection(): ReactNode {
  const { isSimple } = useUIMode();
  const mounted = useHydrated();
  const {
    markets,
    avgApy,
    isLoading: marketsLoading,
    isError: marketsError,
  } = useDashboardMarkets();
  const {
    stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useProtocolStats({ enabled: mounted });

  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    for (const market of markets) {
      const address =
        getTokenAddressForPricing(market.metadata?.yieldTokenSymbol) ??
        market.metadata?.underlyingAddress;
      if (address !== undefined) {
        addresses.add(address);
      }
    }
    return Array.from(addresses);
  }, [markets]);

  const { data: prices, isLoading: pricesLoading } = usePrices(tokenAddresses, {
    enabled: mounted,
  });

  const marketSummary = useMemo(
    () => summarizeMarkets(markets, avgApy.multipliedBy(100).toNumber(), prices),
    [markets, avgApy, prices]
  );

  const isMarketPending = !mounted || marketsLoading;
  const metrics = buildWorkbenchMetrics({
    marketSummary,
    markets,
    marketsError,
    pricesLoading,
    stats,
    statsError,
    statsLoading,
    isMarketPending,
    mounted,
  });
  const actions = isSimple ? SIMPLE_ACTIONS : ADVANCED_ACTIONS;

  return (
    <section className="border-border/60 bg-background border-b">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-10">
        <div className="grid gap-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <WorkbenchIntro
              isSimple={isSimple}
              isMarketPending={isMarketPending}
              marketsError={marketsError}
            />
            <MarketFocusPanel marketSummary={marketSummary} />
          </div>
          <MetricGrid metrics={metrics} />
        </div>
        <TaskRail isSimple={isSimple} actions={actions} />
      </div>
    </section>
  );
}

function buildWorkbenchMetrics({
  marketSummary,
  markets,
  marketsError,
  pricesLoading,
  stats,
  statsError,
  statsLoading,
  isMarketPending,
  mounted,
}: MetricInputs): WorkbenchMetric[] {
  return [
    buildActiveMarketsMetric(markets, marketsError, marketSummary, isMarketPending),
    buildAvgApyMetric(markets, marketsError, marketSummary, isMarketPending),
    buildPoolValueMetric(markets, marketSummary, pricesLoading, isMarketPending),
    buildFlowMetric(stats, statsError, statsLoading, mounted),
  ];
}

function buildActiveMarketsMetric(
  markets: MarketData[],
  marketsError: boolean,
  marketSummary: MarketSummary,
  isMarketPending: boolean
): WorkbenchMetric {
  return {
    label: 'Active markets',
    value: marketsError ? 'Unavailable' : String(markets.length),
    detail: marketsError
      ? 'RPC and fallback market sources did not return market data.'
      : marketSummary.expiryDetail,
    state: marketsError ? 'warning' : markets.length > 0 ? 'ok' : 'muted',
    loading: isMarketPending,
  };
}

function buildAvgApyMetric(
  markets: MarketData[],
  marketsError: boolean,
  marketSummary: MarketSummary,
  isMarketPending: boolean
): WorkbenchMetric {
  const hasMarkets = markets.length > 0;

  return {
    label: 'Avg implied APY',
    value: marketsError || !hasMarkets ? 'Unavailable' : `${marketSummary.avgApy.toFixed(2)}%`,
    detail: hasMarkets
      ? 'Derived from the market hook primary APY, which uses TWAP with spot fallback.'
      : 'Rate appears after at least one market is available.',
    state: marketsError ? 'warning' : hasMarkets ? 'ok' : 'muted',
    loading: isMarketPending,
  };
}

function buildPoolValueMetric(
  markets: MarketData[],
  marketSummary: MarketSummary,
  pricesLoading: boolean,
  isMarketPending: boolean
): WorkbenchMetric {
  return {
    label: 'Pool value',
    value: marketSummary.tvlUsdAvailable ? formatUsdCompact(marketSummary.tvlUsd) : 'Unavailable',
    detail: getPoolValueDetail(markets.length, pricesLoading, marketSummary.tvlUsdAvailable),
    state: marketSummary.tvlUsdAvailable ? 'ok' : 'muted',
    loading: isMarketPending,
  };
}

function buildFlowMetric(
  stats: MetricInputs['stats'],
  statsError: boolean,
  statsLoading: boolean,
  mounted: boolean
): WorkbenchMetric {
  return {
    label: '24h flow',
    value: statsError
      ? 'Indexer unavailable'
      : `${formatCompactNumber(Number(fromWad(stats.volume24h)))} SY`,
    detail: statsError
      ? 'Indexer-only volume and fee telemetry is not available.'
      : `${String(stats.swaps24h)} swaps, ${formatCompactNumber(Number(fromWad(stats.fees24h)))} SY fees`,
    state: statsError ? 'warning' : 'ok',
    loading: !mounted || statsLoading,
  };
}

function getPoolValueDetail(
  marketCount: number,
  pricesLoading: boolean,
  tvlUsdAvailable: boolean
): string {
  if (marketCount === 0) {
    return 'No market reserves are loaded yet.';
  }
  if (pricesLoading) {
    return 'Waiting for token pricing before showing USD value.';
  }
  if (tvlUsdAvailable) {
    return 'Reserve value from loaded market balances and existing token price helpers.';
  }
  return 'Token prices are unavailable, so USD TVL is not estimated.';
}

function WorkbenchIntro({
  isSimple,
  isMarketPending,
  marketsError,
}: {
  isSimple: boolean;
  isMarketPending: boolean;
  marketsError: boolean;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="border-border bg-surface-elevated text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium uppercase">
          {isSimple ? 'Simple mode' : 'Advanced mode'}
        </span>
        <DataStatePill loading={isMarketPending} isError={marketsError} />
      </div>

      <h1 className="mt-5 max-w-3xl text-3xl font-semibold sm:text-4xl lg:text-5xl">
        Horizon protocol workbench
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
        {isSimple
          ? 'Start with live fixed-yield markets, current rate context, and the shortest path to minting Principal Tokens.'
          : 'Monitor live market state, oracle-backed rate context, and the primary mint, trade, liquidity, portfolio, and analytics paths.'}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/mint" />}>
          {isSimple ? 'Start earning' : 'Mint PT + YT'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={isSimple ? '#markets' : '/trade'} />}
          variant="outline"
        >
          {isSimple ? 'View markets' : 'Trade markets'}
        </Button>
      </div>
    </div>
  );
}

function MarketFocusPanel({ marketSummary }: { marketSummary: MarketSummary }): ReactNode {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase">Market focus</p>
          <h2 className="mt-2 text-lg font-semibold">{marketSummary.focusTitle}</h2>
        </div>
        <LineChart className="text-primary size-5" aria-hidden="true" />
      </div>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{marketSummary.focusDetail}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <FocusDatum label="TWAP ready" value={String(marketSummary.oracleReadyCount)} />
        <FocusDatum label="Spot fallback" value={String(marketSummary.spotOnlyCount)} />
        <FocusDatum label="Matured" value={String(marketSummary.expiredCount)} />
        <FocusDatum label="Priced assets" value={String(marketSummary.pricedAssetCount)} />
      </div>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: WorkbenchMetric[] }): ReactNode {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricTile key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function TaskRail({
  isSimple,
  actions,
}: {
  isSimple: boolean;
  actions: WorkbenchAction[];
}): ReactNode {
  return (
    <aside className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase">Task rail</p>
          <h2 className="mt-2 text-lg font-semibold">
            {isSimple ? 'Fixed-yield path' : 'Protocol paths'}
          </h2>
        </div>
        {isSimple ? (
          <WalletCards className="text-primary size-5" aria-hidden="true" />
        ) : (
          <Layers className="text-primary size-5" aria-hidden="true" />
        )}
      </div>

      <div className="mt-5 grid gap-2">
        {actions.map((action, index) => (
          <WorkbenchActionLink key={action.href} action={action} index={index + 1} />
        ))}
      </div>

      <div className="border-border bg-surface-sunken mt-5 rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <BarChart3 className="text-primary mt-0.5 size-4" aria-hidden="true" />
          <p className="text-muted-foreground text-sm leading-6">
            The market list remains directly below this workbench and keeps its existing loading,
            empty, and offline fallbacks.
          </p>
        </div>
      </div>
    </aside>
  );
}

function summarizeMarkets(
  markets: MarketData[],
  avgApy: number,
  prices: Map<string, number> | undefined
): MarketSummary {
  if (markets.length === 0) {
    return {
      avgApy,
      expiredCount: 0,
      expiryDetail: 'No active market data loaded.',
      focusDetail: 'Markets will appear here when the factory or static fallback returns data.',
      focusTitle: 'No market selected',
      oracleReadyCount: 0,
      pricedAssetCount: 0,
      spotOnlyCount: 0,
      tvlUsd: 0,
      tvlUsdAvailable: false,
    };
  }

  let tvlUsd = 0;
  let pricedAssetCount = 0;
  let oracleReadyCount = 0;
  let spotOnlyCount = 0;
  let expiredCount = 0;
  let nearestExpiry = Number.POSITIVE_INFINITY;

  const activeMarkets = markets.filter((market) => !market.isExpired);
  const bestMarket = (activeMarkets.length > 0 ? activeMarkets : markets).reduce((prev, curr) =>
    curr.impliedApy.toNumber() > prev.impliedApy.toNumber() ? curr : prev
  );

  for (const market of markets) {
    if (market.oracleState === 'ready' || market.oracleState === 'partial') {
      oracleReadyCount += 1;
    } else {
      spotOnlyCount += 1;
    }

    if (market.isExpired) {
      expiredCount += 1;
    } else {
      nearestExpiry = Math.min(nearestExpiry, market.daysToExpiry);
    }

    const priceAddress =
      getTokenAddressForPricing(market.metadata?.yieldTokenSymbol) ??
      market.metadata?.underlyingAddress;
    const price = getTokenPrice(priceAddress, prices);
    if (price > 0) {
      pricedAssetCount += 1;
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      tvlUsd += (syReserve + ptReserve) * price;
    }
  }

  const focusSymbol = bestMarket.metadata?.yieldTokenSymbol ?? 'Market';
  const focusApy = bestMarket.impliedApy.multipliedBy(100).toNumber();
  const expiryDetail =
    nearestExpiry === Number.POSITIVE_INFINITY
      ? `${String(expiredCount)} expired markets loaded.`
      : `Next maturity in ${String(Math.max(0, nearestExpiry))} days.`;

  return {
    avgApy,
    expiredCount,
    expiryDetail,
    focusDetail: `${focusSymbol} shows ${focusApy.toFixed(2)}% implied APY with ${bestMarket.oracleState === 'spot-only' ? 'spot-rate fallback' : 'TWAP rate context'}.`,
    focusTitle: `${focusSymbol} rate lead`,
    oracleReadyCount,
    pricedAssetCount,
    spotOnlyCount,
    tvlUsd,
    tvlUsdAvailable: pricedAssetCount > 0,
  };
}

function DataStatePill({ loading, isError }: { loading: boolean; isError: boolean }): ReactNode {
  if (loading) {
    return (
      <span className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium">
        Checking market data
      </span>
    );
  }

  if (isError) {
    return (
      <span className="border-destructive/30 bg-destructive/10 text-destructive rounded-full border px-3 py-1 text-xs font-medium">
        Market source unavailable
      </span>
    );
  }

  return (
    <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs font-medium">
      Market data loaded
    </span>
  );
}

function MetricTile({ metric }: { metric: WorkbenchMetric }): ReactNode {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4',
        metric.state === 'warning' && 'border-destructive/30 bg-destructive/10',
        metric.state === 'ok' && 'border-border',
        metric.state === 'muted' && 'border-border/70 bg-surface-elevated'
      )}
    >
      <p className="text-muted-foreground text-xs font-medium uppercase">{metric.label}</p>
      {metric.loading === true ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="mt-3 font-mono text-2xl font-semibold">{metric.value}</p>
      )}
      <p className="text-muted-foreground mt-3 text-sm leading-5">{metric.detail}</p>
    </div>
  );
}

function FocusDatum({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="border-border/70 bg-background rounded-lg border p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  );
}

function WorkbenchActionLink({
  action,
  index,
}: {
  action: WorkbenchAction;
  index: number;
}): ReactNode {
  return (
    <Link
      href={action.href}
      className="group border-border hover:border-primary/40 bg-surface-elevated hover:bg-background grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-3 rounded-xl border p-3 transition-[background-color,border-color,color] duration-150"
    >
      <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full font-mono text-sm">
        {index}
      </span>
      <span>
        <span className="block text-sm font-medium">{action.label}</span>
        <span className="text-muted-foreground mt-1 block text-sm leading-5">
          {action.description}
        </span>
      </span>
      <ArrowRight
        className="text-muted-foreground group-hover:text-primary mt-1 size-4 transition-colors"
        aria-hidden="true"
      />
    </Link>
  );
}

function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

function formatCompactNumber(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';
  if (value < 1000) return value.toFixed(2);
  if (value < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}
