'use client';

import { MarketList, SimpleMarketList } from '@entities/market';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { HeroSection } from '@widgets/hero';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function HomePageClient(): ReactNode {
  const { isSimple } = useUIMode();

  return (
    <div>
      <HeroSection />

      <div className="mx-auto max-w-7xl px-4 py-10">
        <section id="markets" aria-labelledby="home-markets-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                Live opportunities
              </p>
              <h2 id="home-markets-heading" className="text-foreground mt-2">
                {isSimple ? 'Fixed-yield markets' : 'Active protocol markets'}
              </h2>
            </div>
            <Link
              href="/analytics"
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              View analytics
            </Link>
          </div>
          {isSimple ? <SimpleMarketList /> : <MarketList />}
        </section>

        <section className="border-border bg-surface-sunken mt-12 rounded-2xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">Next checkpoint</p>
              <h2 className="text-foreground mt-2">
                {isSimple
                  ? 'Choose a market before depositing'
                  : 'Inspect rate depth before routing'}
              </h2>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {isSimple
                  ? 'Use the market cards above to confirm maturity and fixed-rate context, then continue to mint when the market state looks right.'
                  : 'Use the analytics view for liquidity, volume, oracle, and rate context before minting, trading, or adding liquidity.'}
              </p>
            </div>
            <Link
              href={isSimple ? '/mint' : '/analytics'}
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              {isSimple ? 'Continue to mint' : 'Open analytics'}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
