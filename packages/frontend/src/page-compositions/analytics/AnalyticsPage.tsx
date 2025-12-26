'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type ReactNode } from 'react';

// Direct imports for above-the-fold content
import { Skeleton } from '@shared/ui/Skeleton';
import { ProtocolStats } from '@widgets/analytics/ProtocolStats';
import { ProtocolTvlCard } from '@widgets/analytics/ProtocolTvlCard';

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

export function AnalyticsPage(): ReactNode {
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
          Real-time metrics and historical data for Horizon Protocol
        </p>
      </div>

      {/* Protocol Stats Overview */}
      <section className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-semibold">Overview</h2>
        <ProtocolStats />
      </section>

      {/* TVL Section */}
      <section className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-semibold">Total Value Locked</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* TVL Card */}
          <ProtocolTvlCard className="lg:col-span-1" />

          {/* TVL Chart */}
          <TvlChart className="lg:col-span-2" />
        </div>
      </section>

      {/* TVL Breakdown */}
      <section className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-semibold">TVL by Market</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <TvlBreakdown />
          <VolumeByMarket />
        </div>
      </section>

      {/* Volume Section */}
      <section className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-semibold">Trading Volume</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Volume Stats Card */}
          <VolumeStatsCard className="lg:col-span-1" />

          {/* Volume Chart */}
          <VolumeChart className="lg:col-span-2" />
        </div>
      </section>

      {/* Fee Revenue Section */}
      <section className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-semibold">Fee Revenue</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Fee Stats Card */}
          <FeeStatsCard className="lg:col-span-1" />

          {/* Fee Revenue Chart */}
          <FeeRevenueChart className="lg:col-span-2" />
        </div>
      </section>

      {/* Fee Breakdown Section */}
      <section className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-semibold">Fee Breakdown</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <FeeByMarket />
          <FeeCollectionLog />
        </div>
      </section>

      {/* Info Section */}
      <section>
        <div className="border-border bg-card rounded-lg border p-6">
          <h2 className="text-foreground mb-4 text-lg font-semibold">About Analytics</h2>
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>
              <span className="text-foreground font-medium">Total Value Locked (TVL)</span>{' '}
              represents the total value of assets deposited in Horizon Protocol markets, measured
              as the sum of SY and PT reserves across all markets.
            </p>
            <p>
              <span className="text-foreground font-medium">Trading Volume</span> tracks all swap
              activity including PT/SY trades in the AMM. Volume is broken down by token type to
              show the distribution of trading activity.
            </p>
            <p>
              <span className="text-foreground font-medium">Market Breakdown</span> shows how TVL
              and volume are distributed across different yield-bearing assets. Each market
              represents a different underlying token with its own maturity date.
            </p>
            <p>
              <span className="text-foreground font-medium">Fee Revenue</span> tracks protocol fees
              collected from swaps. Fees are charged on each trade and distributed between LPs and
              the protocol. The fee collection log shows when accumulated fees are withdrawn by
              administrators.
            </p>
            <p>
              <span className="text-foreground font-medium">Note:</span> Historical data is being
              built as the protocol operates. Charts will show more data points over time as the
              indexer captures daily snapshots.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
