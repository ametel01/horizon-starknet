'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { useDashboardMarkets } from '@features/markets';
// Direct imports for above-the-fold content
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Skeleton } from '@shared/ui';
import { ProtocolStats } from '@widgets/analytics/ProtocolStats';
import { ProtocolTvlCard } from '@widgets/analytics/ProtocolTvlCard';

// Lazy load yield-native chart components (primary focus)
const YieldCurveChart = dynamic(
  () => import('@widgets/analytics/YieldCurveChart').then((m) => m.YieldCurveChart),
  { loading: () => <ChartSkeleton />, ssr: false }
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

function ChartSkeleton(): ReactNode {
  return <Skeleton className="h-[300px] w-full rounded-lg" />;
}

function CardSkeleton(): ReactNode {
  return <Skeleton className="h-[200px] w-full rounded-lg" />;
}

/**
 * Collapsible section header component
 */
function CollapsibleSectionHeader({
  title,
  isOpen,
}: {
  title: string;
  isOpen: boolean;
}): ReactNode {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <svg
        className={`text-muted-foreground h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export function AnalyticsPage(): ReactNode {
  const { markets } = useDashboardMarkets();
  const [selectedMarket, setSelectedMarket] = useState<string | undefined>(undefined);
  const [tvlOpen, setTvlOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [feesOpen, setFeesOpen] = useState(false);

  // Get active markets for the selector
  const activeMarkets = markets.filter((m) => !m.isExpired);

  // Default to first active market if none selected
  const marketAddress = selectedMarket ?? activeMarkets[0]?.address;

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
        <h1 className="text-foreground text-3xl font-bold">Protocol Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Yield-native analytics and real-time metrics for Horizon Protocol
        </p>
      </div>

      {/* Protocol Stats Overview (compact) */}
      <section className="mb-8">
        <ProtocolStats />
      </section>

      {/* ============================================ */}
      {/* YIELD ANALYTICS SECTION (Primary Focus)     */}
      {/* ============================================ */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Yield Analytics</h2>
          <p className="text-muted-foreground text-sm">Term structure and yield insights</p>
        </div>

        {/* Yield Curve - Full Width */}
        <div className="mb-6">
          <YieldCurveChart />
        </div>

        {/* Market Selector for market-specific charts */}
        {activeMarkets.length > 0 && (
          <div className="mb-4">
            <label className="text-muted-foreground mb-2 block text-sm">
              Select market for detailed analysis:
            </label>
            <select
              value={marketAddress}
              onChange={(e) => {
                setSelectedMarket(e.target.value);
              }}
              className="bg-background border-input w-full max-w-md rounded-md border px-3 py-2 text-sm"
            >
              {activeMarkets.map((market) => (
                <option key={market.address} value={market.address}>
                  PT-{market.metadata?.yieldTokenSymbol ?? 'Unknown'} (
                  {Math.round(market.daysToExpiry)} days)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Market-specific yield charts */}
        {marketAddress && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* PT Convergence Chart */}
            <PtConvergenceChart marketAddress={marketAddress} />

            {/* Implied vs Realized APY */}
            <ImpliedVsRealizedChart marketAddress={marketAddress} />
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* EXECUTION QUALITY SECTION                   */}
      {/* ============================================ */}
      {marketAddress && (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-foreground text-lg font-semibold">Execution Quality</h2>
            <p className="text-muted-foreground text-sm">
              Price impact and liquidity depth analysis
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ExecutionQualityPanel marketAddress={marketAddress} />
            <DepthCurve marketAddress={marketAddress} />
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* MARKET MICROSTRUCTURE SECTION (Phase 3)     */}
      {/* ============================================ */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-foreground text-lg font-semibold">Market Microstructure</h2>
          <p className="text-muted-foreground text-sm">
            Protocol-wide liquidity health and spread metrics
          </p>
        </div>
        <LiquidityHealthScore />
      </section>

      {/* ============================================ */}
      {/* COLLAPSIBLE SECTIONS (Existing Analytics)   */}
      {/* ============================================ */}

      {/* TVL Section (Collapsible) */}
      <Collapsible open={tvlOpen} onOpenChange={setTvlOpen} className="mb-4">
        <CollapsibleTrigger className="border-border bg-card hover:bg-muted/50 w-full rounded-lg border p-4 text-left transition-colors">
          <CollapsibleSectionHeader title="Total Value Locked" isOpen={tvlOpen} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <ProtocolTvlCard className="lg:col-span-1" />
            <TvlChart className="lg:col-span-2" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <TvlBreakdown />
            <VolumeByMarket />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Volume Section (Collapsible) */}
      <Collapsible open={volumeOpen} onOpenChange={setVolumeOpen} className="mb-4">
        <CollapsibleTrigger className="border-border bg-card hover:bg-muted/50 w-full rounded-lg border p-4 text-left transition-colors">
          <CollapsibleSectionHeader title="Trading Volume" isOpen={volumeOpen} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <VolumeStatsCard className="lg:col-span-1" />
            <VolumeChart className="lg:col-span-2" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Fee Revenue Section (Collapsible) */}
      <Collapsible open={feesOpen} onOpenChange={setFeesOpen} className="mb-8">
        <CollapsibleTrigger className="border-border bg-card hover:bg-muted/50 w-full rounded-lg border p-4 text-left transition-colors">
          <CollapsibleSectionHeader title="Fee Revenue" isOpen={feesOpen} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <FeeStatsCard className="lg:col-span-1" />
            <FeeRevenueChart className="lg:col-span-2" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <FeeByMarket />
            <FeeCollectionLog />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Info Section */}
      <section>
        <div className="border-border bg-card rounded-lg border p-6">
          <h2 className="text-foreground mb-4 text-lg font-semibold">About Analytics</h2>
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>
              <span className="text-foreground font-medium">Term Structure (Yield Curve)</span>{' '}
              shows the relationship between time to maturity and implied APY across all markets.
              This is the primary view for understanding yield expectations at different horizons.
            </p>
            <p>
              <span className="text-foreground font-medium">PT Convergence</span> visualizes how
              Principal Tokens trade at a discount that converges to par (1.0) as maturity
              approaches. The discount represents the market&apos;s implied yield.
            </p>
            <p>
              <span className="text-foreground font-medium">Implied vs Realized APY</span> compares
              the market&apos;s expected yield (from PT pricing) against the actual underlying
              yield. Positive spread means traders expect higher future yields.
            </p>
            <p>
              <span className="text-foreground font-medium">Execution Quality</span> measures price
              impact on trades. Lower impact indicates better liquidity depth. The median impact
              under 10 bps is considered excellent.
            </p>
            <p>
              <span className="text-foreground font-medium">Depth Curve</span> shows how price
              impact increases with trade size. Use this to plan trade sizing and understand
              liquidity depth at different volume levels.
            </p>
            <p>
              <span className="text-foreground font-medium">Liquidity Health</span> aggregates
              spread proxies, depth scores, and activity metrics into a single health score (0-100)
              for each market. Scores 80+ are excellent.
            </p>
            <p>
              <span className="text-foreground font-medium">Note:</span> Historical data builds up
              as the protocol operates. Charts will show more data points over time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
