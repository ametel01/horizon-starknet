'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { MarketList } from '@/components/markets/MarketList';
import { StatsOverview } from '@/components/markets/StatsOverview';

export default function HomePage(): ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-100">
          Horizon Protocol
        </h1>
        <p className="mt-4 text-lg text-neutral-400">
          Split yield-bearing assets into Principal and Yield Tokens
        </p>
      </div>

      {/* Protocol Stats */}
      <div className="mt-12">
        <StatsOverview />
      </div>

      {/* Markets Section */}
      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-100">Active Markets</h2>
          <Link
            href="/mint"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Mint PT + YT
          </Link>
        </div>
        <MarketList />
      </div>

      {/* Features */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold text-neutral-100">What you can do</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
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
      className="group rounded-lg border border-neutral-800 bg-neutral-900 p-6 transition-colors hover:border-blue-600"
    >
      <h3 className="font-semibold text-neutral-100 group-hover:text-blue-500">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{description}</p>
    </Link>
  );
}
