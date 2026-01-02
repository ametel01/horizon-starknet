'use client';

import type { MarketData } from '@entities/market';
import { useStarknet } from '@features/wallet';
import { ESTIMATED_YIELD_APYS } from '@shared/config/addresses';
import { calculateApyBreakdown } from '@shared/math/apy-breakdown';
import { WAD_BIGINT } from '@shared/math/wad';
import { getSYContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { uint256 } from 'starknet';
import type { MarketApyBreakdown, SyRateData } from '@/types/apy';

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  return uint256.uint256ToBN(value);
}

// Default APY when token is unknown
const DEFAULT_APY = 0.05;

/**
 * Get estimated APY for a yield token based on its symbol
 * Uses known protocol yields as estimates
 *
 * Note: In production, this should come from an on-chain oracle
 * integrated at the smart contract level (e.g., pragma_index_oracle.cairo)
 */
function getEstimatedUnderlyingApy(yieldTokenSymbol: string | undefined): number {
  if (!yieldTokenSymbol) {
    return DEFAULT_APY;
  }

  const symbol = yieldTokenSymbol.toLowerCase();

  // Check for exact matches first
  const exactMatch = ESTIMATED_YIELD_APYS[yieldTokenSymbol];
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  // Check for partial matches (includes() covers exact matches too)
  if (symbol.includes('wsteth')) {
    return ESTIMATED_YIELD_APYS['wstETH'] ?? DEFAULT_APY;
  }
  if (symbol.includes('nststrk')) {
    return ESTIMATED_YIELD_APYS['nstSTRK'] ?? DEFAULT_APY;
  }
  if (symbol.includes('sstrk')) {
    return ESTIMATED_YIELD_APYS['sSTRK'] ?? DEFAULT_APY;
  }

  // Default fallback
  return DEFAULT_APY;
}

interface UseApyBreakdownOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Hook to fetch SY exchange rate data for underlying yield calculation
 */
export function useSyRateData(
  syAddress: string | null,
  yieldTokenSymbol: string | undefined,
  options: UseApyBreakdownOptions = {}
): UseQueryResult<SyRateData> {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 60000 } = options;

  // Get estimated APY for this token
  const estimatedApy = getEstimatedUnderlyingApy(yieldTokenSymbol);

  return useQuery({
    queryKey: ['sy-rate', syAddress, yieldTokenSymbol],
    queryFn: async (): Promise<SyRateData> => {
      if (!syAddress) {
        throw new Error('SY address is required');
      }

      const sy = getSYContract(syAddress, provider);

      // Get current exchange rate from SY contract
      const exchangeRate = await sy.exchange_rate();
      const currentRate = toBigInt(exchangeRate as bigint | { low: bigint; high: bigint });

      // Calculate previous rate based on estimated APY
      // dailyGrowth = (1 + APY)^(1/365) - 1 ≈ APY / 365 for small values
      const apyWad = BigInt(Math.floor(estimatedApy * 1e18));
      const estimatedDailyGrowth = apyWad / 365n;
      const previousRate = (currentRate * WAD_BIGINT) / (WAD_BIGINT + estimatedDailyGrowth);

      return {
        currentRate,
        previousRate,
        timeDelta: 86400, // 1 day
        timestamp: Math.floor(Date.now() / 1000),
      };
    },
    enabled: enabled && !!syAddress,
    refetchInterval,
    staleTime: 30000,
    structuralSharing: false,
  });
}

/**
 * Hook to calculate APY breakdown for a market
 *
 * Combines market state with underlying yield data to provide
 * comprehensive APY breakdown for PT, YT, and LP positions.
 */
export function useApyBreakdown(
  market: MarketData | null | undefined,
  options: UseApyBreakdownOptions = {}
): {
  data: MarketApyBreakdown | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { enabled = true } = options;

  // Get the yield token symbol for APY lookup
  const yieldTokenSymbol = market?.metadata?.yieldTokenSymbol;

  // Fetch SY rate data for underlying yield calculation
  const {
    data: syRateData,
    isLoading: isLoadingSyRate,
    isError: isErrorSyRate,
  } = useSyRateData(market?.syAddress ?? null, yieldTokenSymbol, {
    ...options,
    enabled: enabled && !!market,
  });

  // Calculate APY breakdown when we have all data
  const breakdown = useMemo((): MarketApyBreakdown | null => {
    if (!market) {
      return null;
    }

    // Use fetched SY rate data or defaults
    const currentRate = syRateData?.currentRate ?? WAD_BIGINT;
    const previousRate = syRateData?.previousRate ?? WAD_BIGINT;
    const rateTimeDelta = syRateData?.timeDelta ?? 86400;

    // For volume, we'd need an indexer or subgraph
    // For now, estimate based on reserves (placeholder)
    const estimatedDailyVolume = (market.state.syReserve + market.state.ptReserve) / 200n;

    // Get fee rate (default to 0.3% if not available)
    const feeRate = 3_000_000_000_000_000n; // 0.3% in WAD

    return calculateApyBreakdown({
      syReserve: market.state.syReserve,
      ptReserve: market.state.ptReserve,
      lnImpliedRate: market.state.lnImpliedRate,
      expiry: BigInt(market.expiry),
      syExchangeRate: currentRate,
      previousExchangeRate: previousRate,
      rateTimeDelta,
      swapVolume24h: estimatedDailyVolume,
      feeRate,
      lpFeeShare: 0.2, // 20% of fees to LPs
    });
  }, [market, syRateData]);

  return {
    data: breakdown,
    isLoading: isLoadingSyRate,
    isError: isErrorSyRate,
  };
}

/**
 * Hook to get APY breakdown for multiple markets
 */
export function useMarketsApyBreakdown(
  markets: MarketData[],
  _options: UseApyBreakdownOptions = {}
): Map<string, MarketApyBreakdown> {
  // For now, calculate breakdown synchronously for each market
  // In the future, this could batch SY rate fetches

  return useMemo(() => {
    const breakdowns = new Map<string, MarketApyBreakdown>();

    for (const market of markets) {
      // Get token-specific estimated APY
      const yieldTokenSymbol = market.metadata?.yieldTokenSymbol;
      const estimatedApy = getEstimatedUnderlyingApy(yieldTokenSymbol);

      // Calculate estimated daily growth based on token's APY
      const apyWad = BigInt(Math.floor(estimatedApy * 1e18));
      const estimatedDailyGrowth = apyWad / 365n;

      // Use WAD as current rate, calculate previous rate based on estimated growth
      const currentRate = WAD_BIGINT;
      const previousRate = (currentRate * WAD_BIGINT) / (WAD_BIGINT + estimatedDailyGrowth);

      const breakdown = calculateApyBreakdown({
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        lnImpliedRate: market.state.lnImpliedRate,
        expiry: BigInt(market.expiry),
        syExchangeRate: currentRate,
        previousExchangeRate: previousRate,
        rateTimeDelta: 86400,
        swapVolume24h: (market.state.syReserve + market.state.ptReserve) / 200n,
        feeRate: 3_000_000_000_000_000n,
        lpFeeShare: 0.2,
      });

      breakdowns.set(market.address, breakdown);
    }

    return breakdowns;
  }, [markets]);
}
