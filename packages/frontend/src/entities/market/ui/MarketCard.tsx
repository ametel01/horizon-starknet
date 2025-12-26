'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import { ExpiryBadge } from '@/components/display/ExpiryCountdown';
import { ApyDisplay, TokenAmount } from '@entities/token';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { buttonVariants } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';

import type { MarketData } from '../model/types';

interface MarketCardProps {
  market: MarketData;
  className?: string;
}

export function MarketCard({ market, className }: MarketCardProps): ReactNode {
  const { isAdvanced } = useUIMode();
  const shortAddress = `${market.address.slice(0, 6)}...${market.address.slice(-4)}`;
  // Token naming derived from SY symbol (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'Unknown Market';

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
            <TokenAmount
              amount={market.tvlSy}
              symbol={tokenSymbol}
              compact
              className="text-foreground"
            />
          </div>

          {/* Reserves */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Liquidity</span>
            <TokenAmount
              amount={market.state.syReserve}
              symbol={tokenSymbol}
              compact
              className="text-foreground"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">PT Reserve</span>
            <TokenAmount
              amount={market.state.ptReserve}
              symbol={`PT-${tokenSymbol}`}
              compact
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

          {/* Protocol Fees (Advanced mode only) */}
          {isAdvanced && market.state.feesCollected > 0n && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Protocol Fees</span>
              <TokenAmount
                amount={market.state.feesCollected}
                symbol={tokenSymbol}
                compact
                className="text-foreground"
              />
            </div>
          )}
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
