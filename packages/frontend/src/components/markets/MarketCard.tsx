'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import { ExpiryBadge } from '@/components/display/ExpiryCountdown';
import { ApyDisplay, TokenAmount } from '@/components/display/TokenAmount';
import { buttonVariants } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { MarketData } from '@/types/market';

interface MarketCardProps {
  market: MarketData;
  className?: string;
}

export function MarketCard({ market, className }: MarketCardProps): ReactNode {
  const shortAddress = `${market.address.slice(0, 6)}...${market.address.slice(-4)}`;
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'PT';
  const tokenName = market.metadata?.yieldTokenName ?? 'Principal Token';

  return (
    <Card className={cn('hover:border-border/80 transition-colors', className)}>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>PT-{tokenSymbol}</span>
            <ExpiryBadge expiryTimestamp={market.expiry} />
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">{tokenName}</p>
          <p className="text-muted-foreground mt-0.5 font-mono text-xs">{shortAddress}</p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Implied APY */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Implied APY</span>
            <ApyDisplay apy={market.impliedApy.toNumber()} />
          </div>

          {/* TVL */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">TVL</span>
            <TokenAmount amount={market.tvlSy} symbol={tokenSymbol} className="text-foreground" />
          </div>

          {/* Reserves */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Liquidity</span>
            <TokenAmount
              amount={market.state.syReserve}
              symbol={tokenSymbol}
              className="text-foreground"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">PT Reserve</span>
            <TokenAmount
              amount={market.state.ptReserve}
              symbol={`PT-${tokenSymbol}`}
              className="text-foreground"
            />
          </div>

          {/* Days to Expiry */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Days to Expiry</span>
            <span className="text-foreground font-mono">
              {market.isExpired ? 'Expired' : market.daysToExpiry.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/trade?market=${market.address}`}
            className={cn(buttonVariants({ variant: 'default' }), 'flex-1')}
          >
            Trade
          </Link>
          <Link
            href={`/pools?market=${market.address}`}
            className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
          >
            Pool
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
