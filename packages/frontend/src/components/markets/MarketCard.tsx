'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import { ExpiryBadge } from '@/components/display/ExpiryCountdown';
import { ApyDisplay, TokenAmount } from '@/components/display/TokenAmount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { MarketData } from '@/types/market';

interface MarketCardProps {
  market: MarketData;
  className?: string;
}

export function MarketCard({ market, className }: MarketCardProps): ReactNode {
  const shortAddress = `${market.address.slice(0, 6)}...${market.address.slice(-4)}`;

  return (
    <Card className={cn('transition-colors hover:border-neutral-700', className)}>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>PT Market</span>
            <ExpiryBadge expiryTimestamp={market.expiry} />
          </CardTitle>
          <p className="mt-1 font-mono text-xs text-neutral-500">{shortAddress}</p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Implied APY */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Implied APY</span>
            <ApyDisplay apy={market.impliedApy.toNumber()} />
          </div>

          {/* TVL */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">TVL</span>
            <TokenAmount amount={market.tvlSy} symbol="SY" className="text-neutral-100" />
          </div>

          {/* Reserves */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">SY Reserve</span>
            <TokenAmount amount={market.state.syReserve} symbol="SY" className="text-neutral-300" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">PT Reserve</span>
            <TokenAmount amount={market.state.ptReserve} symbol="PT" className="text-neutral-300" />
          </div>

          {/* Days to Expiry */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Days to Expiry</span>
            <span className="font-mono text-neutral-100">
              {market.isExpired ? 'Expired' : market.daysToExpiry.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/trade?market=${market.address}`}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Trade
          </Link>
          <Link
            href={`/pools?market=${market.address}`}
            className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 text-center text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Pool
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
