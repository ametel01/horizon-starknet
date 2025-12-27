'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { MarketList, SimpleMarketList } from '@entities/market';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { HeroSection } from '@widgets/hero';

export default function HomePage(): ReactNode {
  const { isSimple } = useUIMode();

  return (
    <div>
      {/* Hero Section - Immersive gradient with stats */}
      <HeroSection />

      {/* Content sections with container */}
      <div className="mx-auto max-w-7xl px-4 py-16">
        {/* Markets Section */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-foreground">
              {isSimple ? 'Earning Opportunities' : 'Active Markets'}
            </h2>
            <Link
              href="/analytics"
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              View Analytics →
            </Link>
          </div>
          {isSimple ? <SimpleMarketList /> : <MarketList />}
        </section>

        {/* Features - Mode aware */}
        <section className="mt-20">
          <h2 className="text-foreground mb-8">What you can do</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  description="Deposit yield-bearing assets to receive Principal and Yield Tokens"
                  href="/mint"
                />
                <FeatureCard
                  title="Trade"
                  description="Buy or sell Principal Tokens to lock in fixed yields or speculate"
                  href="/trade"
                />
                <FeatureCard
                  title="Provide Liquidity"
                  description="Add liquidity to PT/SY pools and earn trading fees"
                  href="/pools"
                />
                <FeatureCard
                  title="Manage Portfolio"
                  description="View your positions, claim yield, and redeem tokens"
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
        </section>
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
