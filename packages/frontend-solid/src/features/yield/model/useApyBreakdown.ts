import { ESTIMATED_YIELD_APYS } from '@shared/config/addresses';
import { calculateApyBreakdown } from '@shared/math/apy-breakdown';
import { WAD_BIGINT } from '@shared/math/wad';
import { getSYContract } from '@shared/starknet/contracts';
import { createQuery } from '@tanstack/solid-query';
import { type Accessor, createMemo } from 'solid-js';
import { uint256 } from 'starknet';
import type { MarketData } from '@/features/markets';
import { useStarknet } from '@/features/wallet';
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
 * Get estimated APY for a yield token based on its symbol.
 * Uses known protocol yields as estimates.
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

  // Check for partial matches
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

export interface UseSyRateDataReturn {
  data: Accessor<SyRateData | undefined>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  refetch: () => void;
}

/**
 * Hook to fetch SY exchange rate data for underlying yield calculation.
 */
export function useSyRateData(
  syAddress: Accessor<string | null>,
  yieldTokenSymbol: Accessor<string | undefined>,
  options: UseApyBreakdownOptions = {}
): UseSyRateDataReturn {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 60000 } = options;

  const query = createQuery(() => {
    const address = syAddress();
    const symbol = yieldTokenSymbol();
    const estimatedApy = getEstimatedUnderlyingApy(symbol);

    return {
      queryKey: ['sy-rate', address, symbol],
      queryFn: async (): Promise<SyRateData> => {
        if (!address) {
          throw new Error('SY address is required');
        }

        const sy = getSYContract(address, provider);

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
      enabled: enabled && !!address,
      refetchInterval,
      staleTime: 30000,
      structuralSharing: false,
    };
  });

  return {
    data: createMemo(() => query.data),
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError),
    error: createMemo(() => query.error),
    refetch: () => query.refetch(),
  };
}

export interface UseApyBreakdownReturn {
  data: Accessor<MarketApyBreakdown | null>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
}

/**
 * Hook to calculate APY breakdown for a market.
 *
 * Combines market state with underlying yield data to provide
 * comprehensive APY breakdown for PT, YT, and LP positions.
 */
export function useApyBreakdown(
  market: Accessor<MarketData | null | undefined>,
  options: UseApyBreakdownOptions = {}
): UseApyBreakdownReturn {
  const { enabled = true } = options;

  // Get the yield token symbol for APY lookup
  const yieldTokenSymbol = createMemo(() => market()?.metadata?.yieldTokenSymbol);

  // Get SY address
  const syAddress = createMemo(() => market()?.syAddress ?? null);

  // Fetch SY rate data for underlying yield calculation
  const syRateQuery = useSyRateData(syAddress, yieldTokenSymbol, {
    ...options,
    enabled: enabled && !!market(),
  });

  // Calculate APY breakdown when we have all data
  const breakdown = createMemo((): MarketApyBreakdown | null => {
    const marketData = market();
    if (!marketData) {
      return null;
    }

    // Use fetched SY rate data or defaults
    const syRateData = syRateQuery.data();
    const currentRate = syRateData?.currentRate ?? WAD_BIGINT;
    const previousRate = syRateData?.previousRate ?? WAD_BIGINT;
    const rateTimeDelta = syRateData?.timeDelta ?? 86400;

    // For volume, we'd need an indexer or subgraph
    // For now, estimate based on reserves (placeholder)
    const estimatedDailyVolume = (marketData.state.syReserve + marketData.state.ptReserve) / 200n;

    // Get fee rate (default to 0.3% if not available)
    const feeRate = 3_000_000_000_000_000n; // 0.3% in WAD

    return calculateApyBreakdown({
      syReserve: marketData.state.syReserve,
      ptReserve: marketData.state.ptReserve,
      lnImpliedRate: marketData.state.lnImpliedRate,
      expiry: BigInt(marketData.expiry),
      syExchangeRate: currentRate,
      previousExchangeRate: previousRate,
      rateTimeDelta,
      swapVolume24h: estimatedDailyVolume,
      feeRate,
      lpFeeShare: 0.2, // 20% of fees to LPs
    });
  });

  return {
    data: breakdown,
    isLoading: syRateQuery.isLoading,
    isError: syRateQuery.isError,
  };
}

/**
 * Hook to get APY breakdown for multiple markets.
 */
export function useMarketsApyBreakdown(
  markets: Accessor<MarketData[]>
): Accessor<Map<string, MarketApyBreakdown>> {
  // For now, calculate breakdown synchronously for each market
  // In the future, this could batch SY rate fetches

  return createMemo(() => {
    const breakdowns = new Map<string, MarketApyBreakdown>();
    const marketList = markets();

    for (const market of marketList) {
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
  });
}
