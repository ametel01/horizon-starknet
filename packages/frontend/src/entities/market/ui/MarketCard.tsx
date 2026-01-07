'use client';

import { TokenAmount } from '@entities/token';
import { formatApyWithStatus, type OracleStatus, OracleStatusBadge } from '@features/oracle';
import { ApyBreakdown, NegativeYieldWarning, useApyBreakdown } from '@features/yield';
import { TWAP_DEFAULT_DURATION, TWAP_ESTIMATED_READY_DEFAULT } from '@shared/config/twap';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { buttonVariants } from '@shared/ui/Button';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@shared/ui/hover-card';
import { RateSparkline } from '@widgets/analytics/RateSparkline';
import { ExpiryBadge } from '@widgets/display/ExpiryCountdown';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { memo, type ReactNode, useMemo } from 'react';

import type { MarketData } from '../model/types';

import { AssetTypeBadge } from './AssetTypeBadge';

/**
 * Build OracleStatus object from MarketData for badge display
 */
function buildOracleStatus(market: MarketData): OracleStatus {
  const baseStatus = {
    rate: market.state.lnImpliedRate,
  };

  switch (market.oracleState) {
    case 'ready':
      return {
        ...baseStatus,
        state: 'ready',
        apy: market.twapImpliedApy.toNumber(),
        duration: market.twapDuration,
      };
    case 'partial':
      return {
        ...baseStatus,
        state: 'partial',
        apy: market.twapImpliedApy.toNumber(),
        availableDuration: market.twapDuration,
        requestedDuration: TWAP_DEFAULT_DURATION,
      };
    case 'spot-only':
      return {
        ...baseStatus,
        state: 'spot-only',
        apy: market.spotImpliedApy.toNumber(),
        estimatedReadyIn: TWAP_ESTIMATED_READY_DEFAULT,
      };
  }
}

interface MarketCardProps {
  market: MarketData;
  /** Highlight this market as the recommended option (Paradox of Choice) */
  isRecommended?: boolean;
  className?: string | undefined;
}

/**
 * Stat row component for compact data display
 * Memoized to prevent re-renders in the stats grid
 */
const StatRow = memo(function StatRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden">
      <span className="text-compact text-muted-foreground flex-shrink-0">{label}</span>
      <span className="truncate text-right">{children}</span>
    </div>
  );
});

/**
 * Visual yield bar that scales with APY percentage
 * Memoized since it's purely presentational
 */
const YieldBar = memo(function YieldBar({ apy }: { apy: number }): ReactNode {
  // Cap at 100% width, scale so 20% APY = 100% bar
  const width = Math.min(apy * 5, 100);

  return (
    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
      <div
        className="from-chart-1 to-primary h-full rounded-full bg-gradient-to-r transition-all duration-500"
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
});

/**
 * MarketCard - Redesigned with visual hierarchy and yield indicators
 *
 * Features:
 * - Yield intensity glow that scales with APY
 * - Token icon placeholder
 * - APY hero display with gradient
 * - Visual yield bar
 * - Compact 2-column stats grid
 * - Hover effects and animations
 *
 * Memoized to prevent re-renders when parent list updates
 */
export const MarketCard = memo(function MarketCard({
  market,
  isRecommended = false,
  className,
}: MarketCardProps): ReactNode {
  const { isAdvanced } = useUIMode();

  // Token naming derived from SY symbol
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'Unknown Market';

  // Calculate APY percentage for display and effects
  const apyPercent = useMemo(() => market.impliedApy.toNumber() * 100, [market.impliedApy]);

  // Glow intensity scales with APY (capped at 20% APY = max glow)
  const glowOpacity = useMemo(() => Math.min(apyPercent / 20, 1), [apyPercent]);

  // Get APY breakdown for hover display
  const { data: apyBreakdown } = useApyBreakdown(market);

  return (
    <Card
      className={cn(
        'group relative overflow-hidden',
        'transition-all duration-300',
        'hover:shadow-primary/5 hover:shadow-lg',
        'card-hover-glow',
        isRecommended && 'ring-primary/30 ring-2',
        className
      )}
    >
      {/* Yield intensity glow overlay - stronger for higher APY */}
      <div
        className="from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br transition-all duration-500 group-hover:via-transparent"
        style={{ opacity: glowOpacity }}
        aria-hidden="true"
      />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between gap-3">
          {/* Token info with icon */}
          <div className="min-w-0 flex-1 overflow-hidden">
            <CardTitle className="flex items-center gap-2">
              {/* Token icon placeholder */}
              <div className="bg-primary/10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
                <span className="text-primary font-mono text-xs">PT</span>
              </div>
              <div className="min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-base font-semibold">PT-{tokenSymbol}</span>
                  {isRecommended && (
                    <Badge
                      variant="default"
                      className="bg-primary text-primary-foreground gap-0.5 px-1.5 py-0 text-[10px]"
                    >
                      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                      <span>Top</span>
                    </Badge>
                  )}
                  <AssetTypeBadge syAddress={market.syAddress} />
                  <NegativeYieldWarning syAddress={market.syAddress} variant="badge" />
                  <ExpiryBadge expiryTimestamp={market.expiry} />
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{tokenName}</p>
              </div>
            </CardTitle>
          </div>

          {/* APY Hero Display - compact with hover breakdown and oracle status */}
          <HoverCard>
            <HoverCardTrigger className="flex-shrink-0 cursor-help text-right">
              <div className="flex items-center justify-end gap-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  APY
                </span>
                <OracleStatusBadge status={buildOracleStatus(market)} className="text-[10px]" />
              </div>
              <div className="text-primary font-mono text-xl font-semibold tabular-nums">
                {apyPercent >= 0 ? '+' : ''}
                {apyPercent.toFixed(1)}%
              </div>
              {market.oracleState !== 'spot-only' && (
                <div className="text-muted-foreground text-[10px]">
                  Current: {formatApyWithStatus(market.spotImpliedApy.toNumber())}
                </div>
              )}
            </HoverCardTrigger>
            {apyBreakdown && (
              <HoverCardContent side="top" align="end" className="w-80">
                <div className="space-y-2">
                  <div className="text-foreground text-sm font-medium">APY Breakdown</div>
                  <ApyBreakdown breakdown={apyBreakdown} view="pt" />
                  {market.oracleState !== 'spot-only' && (
                    <div className="border-border mt-2 border-t pt-2">
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>TWAP Rate ({market.twapDuration / 60}m)</span>
                        <span className="font-medium">
                          {formatApyWithStatus(market.twapImpliedApy.toNumber())}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>Spot Rate</span>
                        <span className="font-medium">
                          {formatApyWithStatus(market.spotImpliedApy.toNumber())}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </HoverCardContent>
            )}
          </HoverCard>
        </div>
      </CardHeader>

      <CardContent className="relative">
        {/* Visual yield bar */}
        <div className="mb-4">
          <YieldBar apy={apyPercent} />
        </div>

        {/* Compact stats grid - 2 columns */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <StatRow label="TVL">
            <TokenAmount
              amount={market.tvlSy}
              symbol={tokenSymbol}
              compact
              className="metric text-foreground"
            />
          </StatRow>

          <StatRow label="Liquidity">
            <TokenAmount
              amount={market.state.syReserve}
              symbol={tokenSymbol}
              compact
              className="metric text-foreground"
            />
          </StatRow>

          <StatRow label="Days Left">
            <span className="metric text-foreground">
              {market.isExpired ? 'Expired' : Math.round(market.daysToExpiry)}
            </span>
          </StatRow>

          <StatRow label="7d Trend">
            <RateSparkline
              marketAddress={market.address}
              width={56}
              height={20}
              days={7}
              showChange
            />
          </StatRow>

          {/* Protocol Fees (Advanced mode only) */}
          {isAdvanced && market.state.feesCollected > 0n && (
            <StatRow label="Fees">
              <TokenAmount
                amount={market.state.feesCollected}
                symbol={tokenSymbol}
                compact
                className="metric text-foreground"
              />
            </StatRow>
          )}
        </div>

        {/* Action buttons with hover reveal */}
        <div className="mt-4 flex gap-2 opacity-80 transition-opacity group-hover:opacity-100">
          <Link
            href={`/trade?market=${market.address}`}
            className={cn(buttonVariants({ variant: 'default' }), 'flex-1')}
          >
            Trade PT
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
});
