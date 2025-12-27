'use client';

import { ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@shared/ui';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import { BentoCard, BentoGrid } from '@shared/ui/BentoCard';

// Lazy load yield-native chart components (primary focus)
const YieldCurveChart = dynamic(
  () => import('@widgets/analytics/YieldCurveChart').then((m) => m.YieldCurveChart),
  { loading: () => <ChartSkeleton height="h-full min-h-[360px]" />, ssr: false }
);

const PtConvergenceChart = dynamic(
  () => import('@widgets/analytics/PtConvergenceChart').then((m) => m.PtConvergenceChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const ImpliedVsRealizedChart = dynamic(
  () => import('@widgets/analytics/ImpliedVsRealizedChart').then((m) => m.ImpliedVsRealizedChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const ExecutionQualityPanel = dynamic(
  () => import('@widgets/analytics/ExecutionQualityPanel').then((m) => m.ExecutionQualityPanel),
  { loading: () => <ChartSkeleton />, ssr: false }
);

// Phase 3: Market Microstructure
const DepthCurve = dynamic(
  () => import('@widgets/analytics/DepthCurve').then((m) => m.DepthCurve),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const LiquidityHealthScore = dynamic(
  () => import('@widgets/analytics/LiquidityHealthScore').then((m) => m.LiquidityHealthScore),
  { loading: () => <ChartSkeleton />, ssr: false }
);

// Lazy load chart components (recharts is heavy ~200KB)
const TvlChart = dynamic(() => import('@widgets/analytics/TvlChart').then((m) => m.TvlChart), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});

const TvlBreakdown = dynamic(
  () => import('@widgets/analytics/TvlBreakdown').then((m) => m.TvlBreakdown),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const VolumeByMarket = dynamic(
  () => import('@widgets/analytics/VolumeByMarket').then((m) => m.VolumeByMarket),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const VolumeStatsCard = dynamic(
  () => import('@widgets/analytics/VolumeStatsCard').then((m) => m.VolumeStatsCard),
  { loading: () => <CardSkeleton /> }
);

const VolumeChart = dynamic(
  () => import('@widgets/analytics/VolumeChart').then((m) => m.VolumeChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const FeeStatsCard = dynamic(
  () => import('@widgets/analytics/FeeRevenueChart').then((m) => m.FeeStatsCard),
  { loading: () => <CardSkeleton /> }
);

const FeeRevenueChart = dynamic(
  () => import('@widgets/analytics/FeeRevenueChart').then((m) => m.FeeRevenueChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const FeeByMarket = dynamic(
  () => import('@widgets/analytics/FeeByMarket').then((m) => m.FeeByMarket),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const FeeCollectionLog = dynamic(
  () => import('@widgets/analytics/FeeCollectionLog').then((m) => m.FeeCollectionLog),
  { loading: () => <ChartSkeleton /> }
);

function ChartSkeleton({ height = 'h-[300px]' }: { height?: string }): ReactNode {
  return <Skeleton className={cn(height, 'w-full rounded-lg')} />;
}

function CardSkeleton(): ReactNode {
  return <Skeleton className="h-[200px] w-full rounded-lg" />;
}

export function AnalyticsPage(): ReactNode {
  const { markets, avgApy } = useDashboardMarkets();
  const [selectedMarket, setSelectedMarket] = useState<string | undefined>(undefined);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Get active markets for the selector
  const activeMarkets = markets.filter((m) => !m.isExpired);

  // Default to first active market if none selected
  const marketAddress = selectedMarket ?? activeMarkets[0]?.address;

  // Get token addresses for USD pricing
  const tokenAddresses = markets
    .map(
      (m) =>
        getTokenAddressForPricing(m.metadata?.yieldTokenSymbol) ?? m.metadata?.underlyingAddress
    )
    .filter((addr): addr is string => addr !== undefined);

  const { data: prices } = usePrices(tokenAddresses);

  // Calculate TVL in USD
  let tvlUsd = 0;
  for (const market of markets) {
    const symbol = market.metadata?.yieldTokenSymbol;
    const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
    const price = getTokenPrice(priceAddr, prices);
    const syReserve = Number(fromWad(market.state.syReserve));
    const ptReserve = Number(fromWad(market.state.ptReserve));
    tvlUsd += (syReserve + ptReserve) * price;
  }

  const apyPercent = avgApy.multipliedBy(100).toNumber();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Compact Header */}
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
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Analytics</h1>
        <p className="text-muted-foreground mt-1">Yield-native protocol metrics</p>
      </header>

      {/* ============================================ */}
      {/* BENTO GRID - Primary Analytics              */}
      {/* ============================================ */}
      <BentoGrid className="mb-8">
        {/* Hero: Yield Curve - spans 8 columns on lg, 3 rows */}
        <BentoCard colSpan={{ default: 12, lg: 8 }} rowSpan={3} featured animationDelay={0}>
          <div className="flex h-full flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
                Yield Curve
              </h2>
              <span className="text-muted-foreground text-xs">Term Structure</span>
            </div>
            <div className="min-h-0 flex-1">
              <YieldCurveChart />
            </div>
          </div>
        </BentoCard>

        {/* Stats stack - 4 columns each on lg */}
        <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} animationDelay={50}>
          <StatCell
            label="Total TVL"
            value={tvlUsd}
            formatter={formatUsdCompact}
            sublabel={`${String(markets.length)} markets`}
          />
        </BentoCard>

        <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} animationDelay={100}>
          <StatCell
            label="Avg Implied APY"
            value={apyPercent}
            formatter={(v) => `${v.toFixed(2)}%`}
            highlight
          />
        </BentoCard>

        <BentoCard
          colSpan={{ default: 12, lg: 4 }}
          rowSpan={1}
          animationDelay={150}
          className="lg:row-span-1"
        >
          <div className="flex h-full flex-col justify-center p-4">
            <span className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
              Select Market
            </span>
            {activeMarkets.length > 0 ? (
              <Select
                value={marketAddress}
                onValueChange={(value) => {
                  if (value) setSelectedMarket(value);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {(() => {
                      const selected = activeMarkets.find((m) => m.address === marketAddress);
                      if (!selected) return 'Select';
                      return `PT-${selected.metadata?.yieldTokenSymbol ?? '?'}`;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeMarkets.map((market) => (
                    <SelectItem key={market.address} value={market.address}>
                      PT-{market.metadata?.yieldTokenSymbol ?? 'Unknown'} (
                      {Math.round(market.daysToExpiry)}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-muted-foreground text-sm">No active markets</span>
            )}
          </div>
        </BentoCard>

        {/* PT Convergence - 6 columns, 2 rows */}
        <BentoCard colSpan={{ default: 12, md: 6 }} rowSpan={2} animationDelay={200}>
          <div className="flex h-full flex-col p-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold tracking-wider uppercase">
              PT Convergence
            </h3>
            <div className="min-h-0 flex-1">
              {marketAddress ? (
                <PtConvergenceChart marketAddress={marketAddress} />
              ) : (
                <EmptyState message="Select a market" />
              )}
            </div>
          </div>
        </BentoCard>

        {/* Implied vs Realized - 6 columns, 2 rows */}
        <BentoCard colSpan={{ default: 12, md: 6 }} rowSpan={2} animationDelay={250}>
          <div className="flex h-full flex-col p-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold tracking-wider uppercase">
              Implied vs Realized APY
            </h3>
            <div className="min-h-0 flex-1">
              {marketAddress ? (
                <ImpliedVsRealizedChart marketAddress={marketAddress} />
              ) : (
                <EmptyState message="Select a market" />
              )}
            </div>
          </div>
        </BentoCard>

        {/* Depth Curve - Full width, 2 rows */}
        <BentoCard colSpan={{ default: 12 }} rowSpan={2} animationDelay={300}>
          <div className="flex h-full flex-col p-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold tracking-wider uppercase">
              Market Depth
            </h3>
            <div className="min-h-0 flex-1">
              {marketAddress ? (
                <DepthCurve marketAddress={marketAddress} />
              ) : (
                <EmptyState message="Select a market" />
              )}
            </div>
          </div>
        </BentoCard>

        {/* Liquidity Health - Full width */}
        <BentoCard colSpan={{ default: 12 }} rowSpan={2} animationDelay={350}>
          <div className="p-4">
            <h3 className="text-foreground mb-4 text-sm font-semibold tracking-wider uppercase">
              Liquidity Health
            </h3>
            <LiquidityHealthScore />
          </div>
        </BentoCard>
      </BentoGrid>

      {/* ============================================ */}
      {/* ADVANCED ANALYTICS (Collapsible)            */}
      {/* ============================================ */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mb-8">
        <CollapsibleTrigger className="border-border bg-card hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Advanced Analytics</h2>
            <p className="text-muted-foreground text-sm">
              Execution quality, TVL breakdown, volume, and fee metrics
            </p>
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground h-5 w-5 transition-transform',
              advancedOpen && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-8">
          {/* Execution Quality */}
          <section>
            <h3 className="text-foreground mb-4 font-semibold">Execution Quality</h3>
            {marketAddress ? (
              <ExecutionQualityPanel marketAddress={marketAddress} />
            ) : (
              <EmptyState message="Select a market above" />
            )}
          </section>

          {/* TVL Section */}
          <section>
            <h3 className="text-foreground mb-4 font-semibold">Total Value Locked</h3>
            <div className="grid gap-6 lg:grid-cols-2">
              <TvlChart />
              <TvlBreakdown />
            </div>
            <div className="mt-6">
              <VolumeByMarket />
            </div>
          </section>

          {/* Volume Section */}
          <section>
            <h3 className="text-foreground mb-4 font-semibold">Trading Volume</h3>
            <div className="grid gap-6 lg:grid-cols-3">
              <VolumeStatsCard className="lg:col-span-1" />
              <VolumeChart className="lg:col-span-2" />
            </div>
          </section>

          {/* Fee Revenue Section */}
          <section>
            <h3 className="text-foreground mb-4 font-semibold">Fee Revenue</h3>
            <div className="grid gap-6 lg:grid-cols-3">
              <FeeStatsCard className="lg:col-span-1" />
              <FeeRevenueChart className="lg:col-span-2" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <FeeByMarket />
              <FeeCollectionLog />
            </div>
          </section>
        </CollapsibleContent>
      </Collapsible>

      {/* Info Section */}
      <section className="border-border bg-card/50 rounded-lg border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold tracking-wider uppercase">
          About These Metrics
        </h2>
        <div className="text-muted-foreground grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-foreground font-medium">Yield Curve</span>
            <p className="mt-1">
              Shows implied APY across maturities. The term structure reveals market yield
              expectations.
            </p>
          </div>
          <div>
            <span className="text-foreground font-medium">PT Convergence</span>
            <p className="mt-1">
              Principal Tokens trade at discount, converging to par at maturity. Discount = implied
              yield.
            </p>
          </div>
          <div>
            <span className="text-foreground font-medium">Implied vs Realized</span>
            <p className="mt-1">
              Compares market expectations to actual yield. Positive spread = bullish yield outlook.
            </p>
          </div>
          <div>
            <span className="text-foreground font-medium">Market Depth</span>
            <p className="mt-1">
              Price impact by trade size. Use to plan sizing. Under 10bps impact is excellent.
            </p>
          </div>
          <div>
            <span className="text-foreground font-medium">Liquidity Health</span>
            <p className="mt-1">
              Aggregated score (0-100) from spread, depth, and activity. 80+ is excellent.
            </p>
          </div>
          <div>
            <span className="text-foreground font-medium">Note</span>
            <p className="mt-1">
              Historical data accumulates over time. Charts show more detail as protocol operates.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

interface StatCellProps {
  label: string;
  value: number;
  formatter: (value: number) => string;
  sublabel?: string | undefined;
  highlight?: boolean | undefined;
}

function StatCell({
  label,
  value,
  formatter,
  sublabel,
  highlight = false,
}: StatCellProps): ReactNode {
  return (
    <div className="flex h-full flex-col justify-center p-4">
      <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </span>
      <span
        className={cn(
          'mt-1 font-mono text-2xl font-semibold',
          highlight ? 'text-primary' : 'text-foreground'
        )}
      >
        <AnimatedNumber value={value} formatter={formatter} duration={600} />
      </span>
      {sublabel !== undefined && (
        <span className="text-muted-foreground mt-1 text-xs">{sublabel}</span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }): ReactNode {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      {message}
    </div>
  );
}

function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(0)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}
