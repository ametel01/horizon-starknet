'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import { ProtocolStats, ProtocolTvlCard, TvlBreakdown, TvlChart } from '@/components/analytics';

export default function AnalyticsPage(): ReactNode {
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

          {/* Placeholder for future volume chart */}
          <div className="border-border bg-card flex items-center justify-center rounded-lg border p-8">
            <div className="text-center">
              <svg
                className="text-muted-foreground mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-muted-foreground mt-4 text-sm">Volume analytics coming soon</p>
            </div>
          </div>
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
              <span className="text-foreground font-medium">Market Breakdown</span> shows how TVL is
              distributed across different yield-bearing assets. Each market represents a different
              underlying token with its own maturity date.
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
