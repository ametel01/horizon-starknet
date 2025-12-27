'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { MarketList, SimpleMarketList } from '@entities/market';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Button } from '@shared/ui/Button';
import { ProtocolStats } from '@widgets/analytics/ProtocolStats';

export default function HomePage(): ReactNode {
  const { isSimple } = useUIMode();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero Section - Uses display font for elegant heading */}
      <div className="py-8 text-center">
        <h1 className="text-foreground">Horizon Protocol</h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-xl leading-relaxed">
          {isSimple
            ? 'Earn fixed yields on your tokens'
            : 'Split yield-bearing assets into Principal and Yield Tokens'}
        </p>
      </div>

      {/* Protocol Stats */}
      <div className="mt-12">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground">Protocol Stats</h3>
          <Link
            href="/analytics"
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            View Analytics →
          </Link>
        </div>
        <ProtocolStats />
      </div>

      {/* Markets Section */}
      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-foreground">
            {isSimple ? 'Earning Opportunities' : 'Active Markets'}
          </h3>
          <Button nativeButton={false} render={<Link href="/mint" />}>
            {isSimple ? 'Start Earning' : 'Mint PT + YT'}
          </Button>
        </div>
        {isSimple ? <SimpleMarketList /> : <MarketList />}
      </div>

      {/* Features - Mode aware */}
      <div className="mt-16">
        <h3 className="text-foreground">What you can do</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {isSimple ? (
            <>
              <FeatureCard
                title="Earn Fixed Yield"
                description="Deposit tokens and earn a guaranteed fixed rate until maturity"
                href="/mint"
              />
              <FeatureCard
                title="Manage Portfolio"
                description="View your positions and withdraw your earnings"
                href="/portfolio"
              />
            </>
          ) : (
            <>
              <FeatureCard
                title="Mint PT + YT"
                description="Deposit yield-bearing assets to receive Principal Tokens and Yield Tokens"
                href="/mint"
              />
              <FeatureCard
                title="Trade"
                description="Buy or sell Principal Tokens to lock in fixed yields or speculate on rates"
                href="/trade"
              />
              <FeatureCard
                title="Provide Liquidity"
                description="Add liquidity to PT/SY pools and earn trading fees"
                href="/pools"
              />
              <FeatureCard
                title="Manage Portfolio"
                description="View your positions, claim accrued yield, and redeem tokens"
                href="/portfolio"
              />
              <FeatureCard
                title="Analytics"
                description="View protocol metrics, TVL charts, and market statistics"
                href="/analytics"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
}

function FeatureCard({ title, description, href }: FeatureCardProps): ReactNode {
  return (
    <Link
      href={href}
      className="group border-border bg-card hover:border-primary/50 hover:shadow-primary/5 rounded-lg border p-6 transition-all hover:shadow-lg"
    >
      <h4 className="text-foreground group-hover:text-primary transition-colors">{title}</h4>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
    </Link>
  );
}
