'use client';

import { type ReactNode, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format USD value with compact notation for large numbers
 */
function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

interface ProtocolTvlCardProps {
  className?: string;
  showSparkline?: boolean;
}

/**
 * Summary card showing current TVL with optional sparkline.
 * Uses on-chain data from market contracts for accurate reserves.
 */
export function ProtocolTvlCard({
  className,
  showSparkline = true,
}: ProtocolTvlCardProps): ReactNode {
  const { markets, isLoading, isError } = useDashboardMarkets();

  // Extract unique token addresses for price fetching
  // Use symbol-based mapping to get real token addresses for mock/test tokens
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      if (priceAddr) addresses.add(priceAddr);
    }
    return Array.from(addresses);
  }, [markets]);

  const { data: prices, isLoading: pricesLoading } = usePrices(tokenAddresses);

  // Calculate totals from on-chain market data with USD conversion
  const current = useMemo(() => {
    let totalSyReserveUsd = 0;
    let totalPtReserveUsd = 0;

    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      // Use symbol-based address mapping for price lookup
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      const price = getTokenPrice(priceAddr, prices);
      const syReserveNum = Number(fromWad(market.state.syReserve));
      const ptReserveNum = Number(fromWad(market.state.ptReserve));

      totalSyReserveUsd += syReserveNum * price;
      totalPtReserveUsd += ptReserveNum * price;
    }

    return {
      totalTvlUsd: totalSyReserveUsd + totalPtReserveUsd,
      totalSyReserveUsd,
      totalPtReserveUsd,
      marketCount: markets.length,
    };
  }, [markets, prices]);

  // Format data for sparkline (single point since we only have current data)
  const sparklineData = useMemo(() => {
    if (current.totalTvlUsd > 0) {
      return [{ tvl: current.totalTvlUsd }];
    }
    return [];
  }, [current]);

  // Loading state
  if (isLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
          {showSparkline && <Skeleton className="mt-4 h-12 w-full" />}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-destructive text-sm">Failed to load TVL</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          Total Value Locked
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <div className="text-foreground text-3xl font-bold">
            {formatUsdCompact(current.totalTvlUsd)}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            {current.marketCount} {current.marketCount === 1 ? 'market' : 'markets'}
          </div>
        </div>

        {/* Sparkline */}
        {showSparkline && sparklineData.length > 0 && (
          <div className="mt-4 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tvlCardGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="tvl"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="url(#tvlCardGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Reserve breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <div className="text-muted-foreground text-xs">SY Reserve</div>
            <div className="text-foreground font-medium">
              {formatUsdCompact(current.totalSyReserveUsd)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">PT Reserve</div>
            <div className="text-foreground font-medium">
              {formatUsdCompact(current.totalPtReserveUsd)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Minimal version for inline display
 */
interface ProtocolTvlInlineProps {
  className?: string;
}

export function ProtocolTvlInline({ className }: ProtocolTvlInlineProps): ReactNode {
  const { markets, isLoading } = useDashboardMarkets();

  // Extract unique token addresses for price fetching
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      if (priceAddr) addresses.add(priceAddr);
    }
    return Array.from(addresses);
  }, [markets]);

  const { data: prices, isLoading: pricesLoading } = usePrices(tokenAddresses);

  // Calculate USD TVL
  const totalTvlUsd = useMemo(() => {
    let total = 0;
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      const price = getTokenPrice(priceAddr, prices);
      const syReserveNum = Number(fromWad(market.state.syReserve));
      const ptReserveNum = Number(fromWad(market.state.ptReserve));
      total += (syReserveNum + ptReserveNum) * price;
    }
    return total;
  }, [markets, prices]);

  if (isLoading || pricesLoading) {
    return <Skeleton className={cn('h-6 w-20', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-muted-foreground text-sm">TVL:</span>
      <span className="text-foreground font-medium">{formatUsdCompact(totalTvlUsd)}</span>
    </div>
  );
}
