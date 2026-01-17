'use client';

import { useStarknet } from '@features/wallet';
import { getRouterStaticContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

/**
 * Comprehensive market info from RouterStatic's get_market_info.
 * Contains all relevant market data including reserves, rates, and market parameters.
 */
export interface MarketInfoStatic {
  /** SY token address */
  sy: string;
  /** PT token address */
  pt: string;
  /** YT token address */
  yt: string;
  /** Market expiry timestamp (seconds) */
  expiry: number;
  /** Whether the market has expired */
  isExpired: boolean;
  /** SY reserve in the market (WAD) */
  syReserve: bigint;
  /** PT reserve in the market (WAD) */
  ptReserve: bigint;
  /** Total LP token supply (WAD) */
  totalLp: bigint;
  /** Ln of implied rate (WAD) */
  lnImpliedRate: bigint;
  /** PT to SY exchange rate (WAD) */
  ptToSyRate: bigint;
  /** LP to SY value rate (WAD) */
  lpToSyRate: bigint;
  /** Scalar root parameter for AMM pricing (WAD) */
  scalarRoot: bigint;
  /** Ln of fee rate root for fee calculations (WAD) */
  lnFeeRateRoot: bigint;
}

interface UseMarketInfoStaticOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
}

// Helper to convert address (bigint or string) to hex string
function toHexAddress(value: unknown): string {
  if (typeof value === 'bigint') {
    return `0x${value.toString(16).padStart(64, '0')}`;
  }
  return String(value);
}

/**
 * Hook to fetch comprehensive market info from RouterStatic contract.
 *
 * This provides complete market state in a single call, including:
 * - Token addresses (SY, PT, YT)
 * - Expiry information
 * - Reserve balances
 * - Exchange rates
 * - AMM parameters
 *
 * Use this hook when you need the full market picture in one query.
 * For just exchange rates, use useMarketExchangeRates instead.
 *
 * @param marketAddress - The market contract address
 * @param options - Query options
 * @returns MarketInfoStatic or null if RouterStatic not deployed
 *
 * @example
 * ```tsx
 * const { data: marketInfo } = useMarketInfoStatic(marketAddress);
 * if (marketInfo) {
 *   const ptSyRatio = Number(marketInfo.ptToSyRate) / 1e18;
 *   const isExpired = marketInfo.isExpired;
 * }
 * ```
 */
export function useMarketInfoStatic(
  marketAddress: string | null,
  options: UseMarketInfoStaticOptions = {}
): UseQueryResult<MarketInfoStatic | null> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['market-info-static', marketAddress, network],
    queryFn: async (): Promise<MarketInfoStatic | null> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const routerStatic = getRouterStaticContract(provider, network);

      // RouterStatic not deployed on this network
      if (!routerStatic) {
        return null;
      }

      // Call get_market_info to get all market data in one call
      const info = await routerStatic.get_market_info(marketAddress);

      // The response is the MarketInfo struct from the contract
      // Fields match the Cairo struct definition in i_router_static.cairo
      // Use unknown first to handle ABI type variations
      const result = info as unknown as {
        sy: bigint;
        pt: bigint;
        yt: bigint;
        expiry: bigint;
        is_expired: boolean;
        sy_reserve: bigint | { low: bigint; high: bigint };
        pt_reserve: bigint | { low: bigint; high: bigint };
        total_lp: bigint | { low: bigint; high: bigint };
        ln_implied_rate: bigint | { low: bigint; high: bigint };
        pt_to_sy_rate: bigint | { low: bigint; high: bigint };
        lp_to_sy_rate: bigint | { low: bigint; high: bigint };
        scalar_root: bigint | { low: bigint; high: bigint };
        ln_fee_rate_root: bigint | { low: bigint; high: bigint };
      };

      return {
        sy: toHexAddress(result.sy),
        pt: toHexAddress(result.pt),
        yt: toHexAddress(result.yt),
        expiry: Number(result.expiry),
        isExpired: result.is_expired,
        syReserve: toBigInt(result.sy_reserve),
        ptReserve: toBigInt(result.pt_reserve),
        totalLp: toBigInt(result.total_lp),
        lnImpliedRate: toBigInt(result.ln_implied_rate),
        ptToSyRate: toBigInt(result.pt_to_sy_rate),
        lpToSyRate: toBigInt(result.lp_to_sy_rate),
        scalarRoot: toBigInt(result.scalar_root),
        lnFeeRateRoot: toBigInt(result.ln_fee_rate_root),
      };
    },
    enabled: enabled && !!marketAddress,
    refetchInterval,
    staleTime: 15000, // Consider data stale after 15 seconds
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}
