'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import { TokenAmount } from '@/components/display/TokenAmount';
import { buttonVariants } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatExpiry } from '@/lib/math/yield';
import { cn } from '@/lib/utils';
import type { MarketData } from '@/types/market';

interface SimpleMarketCardProps {
  market: MarketData;
  className?: string;
}

/**
 * Simplified market card for simple mode.
 * Shows:
 * - Asset name and current fixed rate
 * - Maturity date
 * - Total deposited (TVL)
 * - Single "Earn Now" CTA
 *
 * Hides:
 * - PT/YT reserves
 * - Implied APY terminology
 * - Technical market details
 */
export function SimpleMarketCard({ market, className }: SimpleMarketCardProps): ReactNode {
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'Yield Token';
  const fixedApy = market.impliedApy.toNumber() * 100;
  const maturityDate = formatExpiry(market.expiry);

  return (
    <Card className={cn('hover:border-border/80 transition-colors', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>{tokenName}</span>
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">{tokenSymbol}</p>
          </div>
          {market.isExpired ? (
            <span className="bg-destructive/20 text-destructive rounded-full px-2 py-1 text-xs font-medium">
              Matured
            </span>
          ) : (
            <span className="bg-primary/20 text-primary rounded-full px-2 py-1 text-xs font-medium">
              {Math.max(0, market.daysToExpiry).toFixed(0)}d left
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Fixed Rate - Primary Info */}
          <div className="border-primary/30 bg-primary/5 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-muted-foreground text-sm">Fixed Rate</div>
                <div className="text-primary text-3xl font-bold">{fixedApy.toFixed(2)}%</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground text-sm">Matures on</div>
                <div className="text-foreground font-medium">{maturityDate}</div>
              </div>
            </div>
          </div>

          {/* Simple Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-lg p-3">
              <div className="text-muted-foreground text-xs">Total Deposited</div>
              <TokenAmount
                amount={market.tvlSy}
                symbol={tokenSymbol}
                className="text-foreground font-medium"
              />
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-muted-foreground text-xs">Available Liquidity</div>
              <TokenAmount
                amount={market.state.syReserve}
                symbol={tokenSymbol}
                className="text-foreground font-medium"
              />
            </div>
          </div>

          {/* CTA */}
          <Link
            href={`/mint?market=${market.address}`}
            className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
          >
            {market.isExpired ? 'View Details' : 'Earn Now'}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simple stats card for dashboard overview
 */
interface SimpleStatsCardProps {
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  className?: string;
}

export function SimpleStatsCard({
  title,
  value,
  subtitle,
  className,
}: SimpleStatsCardProps): ReactNode {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="text-muted-foreground text-sm">{title}</div>
        <div className="text-foreground text-2xl font-bold">{value}</div>
        {subtitle && <div className="text-muted-foreground text-xs">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
