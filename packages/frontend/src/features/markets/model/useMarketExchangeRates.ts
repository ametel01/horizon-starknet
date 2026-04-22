'use client';

import { useStarknet } from '@features/wallet';
import { toBigInt } from '@shared/lib/uint256';
import { getRouterStaticContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Live exchange rates from RouterStatic
 * All rates are in WAD (1e18 = 1:1)
 */
export interface MarketExchangeRates {
  /** PT to SY exchange rate - instantaneous rate at which PT trades for SY */
  ptToSyRate: bigint;
  /** LP to SY rate - value of LP token in SY terms */
  lpToSyRate: bigint;
  /** LP to PT rate - value of LP token in PT terms */
  lpToPtRate: bigint;
}

interface UseMarketExchangeRatesOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch live exchange rates from RouterStatic contract.
 *
 * Fetches PT/SY, LP/SY, and LP/PT exchange rates directly from the chain.
 * These are instantaneous rates, not historical data (for historical rates use useMarketRates).
 *
 * @param marketAddress - The market contract address
 * @param options - Query options
 * @returns Exchange rates in WAD (1e18 precision)
 *
 * @example
 * ```tsx
 * const { data: rates } = useMarketExchangeRates(marketAddress);
 * if (rates) {
 *   const ptToSyRatio = Number(rates.ptToSyRate) / 1e18;
 * }
 * ```
 */
export function useMarketExchangeRates(
  marketAddress: string | null,
  options: UseMarketExchangeRatesOptions = {}
): UseQueryResult<MarketExchangeRates | null> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['market-exchange-rates', marketAddress, network],
    queryFn: async (): Promise<MarketExchangeRates | null> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const routerStatic = getRouterStaticContract(provider, network);

      // RouterStatic not deployed on this network
      if (!routerStatic) {
        return null;
      }

      // Fetch all exchange rates in parallel
      const [ptToSyRate, lpToSyRate, lpToPtRate] = await Promise.all([
        routerStatic.get_pt_to_sy_rate(marketAddress),
        routerStatic.get_lp_to_sy_rate(marketAddress),
        routerStatic.get_lp_to_pt_rate(marketAddress),
      ]);

      return {
        ptToSyRate: toBigInt(ptToSyRate as bigint | { low: bigint; high: bigint }),
        lpToSyRate: toBigInt(lpToSyRate as bigint | { low: bigint; high: bigint }),
        lpToPtRate: toBigInt(lpToPtRate as bigint | { low: bigint; high: bigint }),
      };
    },
    enabled: enabled && !!marketAddress,
    refetchInterval,
    staleTime: 15000, // Consider data stale after 15 seconds
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}
