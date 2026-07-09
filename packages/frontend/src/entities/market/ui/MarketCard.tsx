'use client';

import { TokenAmount } from '@entities/token';
import { MarketRates, useMarketExchangeRates } from '@features/markets';
import { formatApyWithStatus, type OracleStatus, OracleStatusBadge } from '@features/oracle';
import { ApyBreakdown, NegativeYieldWarning, useApyBreakdown } from '@features/yield';
import { TWAP_DEFAULT_DURATION, TWAP_ESTIMATED_READY_DEFAULT } from '@shared/config/twap';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { buttonVariants } from '@shared/ui/Button';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/Collapsible';
import { RateSparkline } from '@widgets/analytics/RateSparkline';
import { ExpiryBadge } from '@widgets/display/ExpiryCountdown';
import { ChevronDown, Sparkles } from 'lucide-react';
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
        className="from-chart-1 to-primary h-full rounded-full bg-gradient-to-r transition-[width] duration-300"
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
});

/**
 * MarketCard - compact market summary with accessible APY details
 *
 * Features:
 * - Token icon placeholder
 * - APY hero display with explicit disclosure for details
 * - Visual yield bar
 * - Compact 2-column stats grid
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
  const oracleStatus = useMemo(() => buildOracleStatus(market), [market]);
  const detailsId = useMemo(
    () => `market-apy-details-${market.address.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [market.address]
  );

  // Get APY breakdown for the explicit disclosure panel.
  const { data: apyBreakdown } = useApyBreakdown(market);

  // Fetch live exchange rates from RouterStatic (updates every 30s)
  const {
    data: exchangeRates,
    isLoading: isRatesLoading,
    isError: isRatesError,
  } = useMarketExchangeRates(market.address);

  return (
    <Card
      data-testid="market-card"
      className={cn(
        'relative overflow-hidden',
        'transition-[border-color,box-shadow] duration-200',
        'hover:ring-foreground/20 focus-within:ring-ring/40',
        isRecommended && 'ring-primary/30 ring-2',
        className
      )}
    >
      <Collapsible>
        <CardHeader className="relative pb-2">
          <div className="flex items-start justify-between gap-3">
            {/* Token info with icon */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <CardTitle className="flex items-center gap-2">
                {/* Token icon placeholder */}
                <div className="bg-primary/10 flex size-9 flex-shrink-0 items-center justify-center rounded-full">
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
                        <Sparkles className="size-2.5" aria-hidden="true" />
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

            <CollapsibleTrigger
              type="button"
              aria-controls={detailsId}
              aria-label={`Toggle APY details for PT-${tokenSymbol}`}
              data-testid="market-apy-details-trigger"
              className={cn(
                'group/details flex-shrink-0 rounded-lg border px-3 py-2 text-right',
                'border-border/70 bg-surface-sunken/60 hover:border-primary/30 hover:bg-muted/60',
                'data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5'
              )}
            >
              <div className="flex items-center justify-end gap-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  APY
                </span>
                <OracleStatusBadge status={oracleStatus} className="text-[10px]" />
              </div>
              <span className="text-primary block font-mono text-xl font-semibold tabular-nums">
                {apyPercent >= 0 ? '+' : ''}
                {apyPercent.toFixed(1)}%
              </span>
              {market.oracleState !== 'spot-only' && (
                <span className="text-muted-foreground block text-[10px]">
                  Current: {formatApyWithStatus(market.spotImpliedApy.toNumber())}
                </span>
              )}
              <span className="text-muted-foreground flex items-center justify-end gap-1 text-[10px]">
                Details
                <ChevronDown
                  className="size-3 transition-transform duration-150 group-data-[state=open]/details:rotate-180"
                  aria-hidden="true"
                />
              </span>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CardContent className="relative">
          {/* Visual yield bar */}
          <div className="mb-4">
            <YieldBar apy={apyPercent} />
          </div>

          <CollapsibleContent id={detailsId}>
            <div
              data-testid="market-apy-details-panel"
              className="border-border/70 bg-surface-sunken/40 mb-4 space-y-3 rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-foreground text-sm font-medium">APY Breakdown</div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
                    <span>Oracle source:</span>
                    <OracleStatusBadge status={oracleStatus} showDetails />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-xs">Implied APY</div>
                  <div className="text-primary font-mono text-sm font-medium">
                    {formatApyWithStatus(market.impliedApy.toNumber())}
                  </div>
                </div>
              </div>

              {apyBreakdown ? (
                <ApyBreakdown breakdown={apyBreakdown} view="pt" />
              ) : (
                <p className="text-muted-foreground text-xs">
                  APY breakdown is loading from the current market state.
                </p>
              )}

              <div className="border-border space-y-1.5 border-t pt-2">
                {market.oracleState !== 'spot-only' && (
                  <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                    <span>TWAP Rate ({market.twapDuration / 60}m)</span>
                    <span className="font-medium">
                      {formatApyWithStatus(market.twapImpliedApy.toNumber())}
                    </span>
                  </div>
                )}
                <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                  <span>Spot Rate</span>
                  <span className="font-medium">
                    {formatApyWithStatus(market.spotImpliedApy.toNumber())}
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleContent>

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

          {/* Live Exchange Rates (Advanced mode only) */}
          {isAdvanced && (
            <MarketRates
              rates={exchangeRates}
              isLoading={isRatesLoading && !exchangeRates}
              isAvailable={!isRatesError}
              className="border-border/50 mt-4 border-t pt-3"
            />
          )}

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
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
      </Collapsible>
    </Card>
  );
});
