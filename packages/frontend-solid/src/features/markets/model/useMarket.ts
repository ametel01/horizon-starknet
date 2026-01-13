import { getMarketInfoByAddress } from '@shared/config/addresses';
import { calculateAnnualFeeRate } from '@shared/lib/fees';
import { daysToExpiry, lnRateToApy } from '@shared/math/yield';
import { logError } from '@shared/server/logger';
import { getMarketContract } from '@shared/starknet/contracts';
import { createQuery } from '@tanstack/solid-query';
import type BigNumber from 'bignumber.js';
import { type Accessor, createMemo } from 'solid-js';
import { uint256 } from 'starknet';

import { useStarknet } from '@/features/wallet';

import { type MarketData, type MarketInfo, type MarketState, marketKeys } from './useMarkets';

export interface UseMarketOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseMarketReturn {
  data: Accessor<MarketData | undefined>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  refetch: () => void;
}

export interface UseMarketInfoReturn {
  data: Accessor<MarketInfo | undefined>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
}

export interface UseMarketStateReturn {
  data: Accessor<(MarketState & { impliedApy: BigNumber }) | undefined>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
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
 * Hook to fetch full market data for a single market address.
 * Uses @tanstack/solid-query for caching and background updates.
 *
 * @param marketAddress - Accessor returning the market address or null
 * @param options - Query options (enabled, refetchInterval)
 */
export function useMarket(
  marketAddress: Accessor<string | null>,
  options: UseMarketOptions = {}
): UseMarketReturn {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  const query = createQuery(() => {
    const address = marketAddress();
    return {
      queryKey: marketKeys.detail(address ?? '', network),
      queryFn: async (): Promise<MarketData> => {
        if (!address) {
          throw new Error('Market address is required');
        }

        try {
          const market = getMarketContract(address, provider);

          // Fetch all market data in parallel using typed contract calls
          const [
            syAddress,
            ptAddress,
            ytAddress,
            expiry,
            isExpiredVal,
            reserves,
            totalLpSupply,
            lnRate,
            feesCollected,
            lnFeeRateRoot,
            reserveFeePercent,
          ] = await Promise.all([
            market.sy(),
            market.pt(),
            market.yt(),
            market.expiry(),
            market.is_expired(),
            market.get_reserves(),
            market.total_lp_supply(),
            market.get_ln_implied_rate(),
            market.get_total_fees_collected(),
            market.get_ln_fee_rate_root(),
            market.get_reserve_fee_percent(),
          ]);

          const info: MarketInfo = {
            address,
            syAddress: toHexAddress(syAddress),
            ptAddress: toHexAddress(ptAddress),
            ytAddress: toHexAddress(ytAddress),
            expiry: Number(expiry),
            isExpired: isExpiredVal,
          };

          // Reserves are returned as a tuple [sy_reserve, pt_reserve]
          const reservesArr = reserves as unknown[];
          const lnFeeRateRootValue = toBigInt(
            lnFeeRateRoot as bigint | { low: bigint; high: bigint }
          );
          const state: MarketState = {
            syReserve: toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint }),
            ptReserve: toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint }),
            totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }),
            lnImpliedRate: toBigInt(lnRate as bigint | { low: bigint; high: bigint }),
            feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
            lnFeeRateRoot: lnFeeRateRootValue,
            reserveFeePercent: Number(reserveFeePercent),
          };

          // Compute derived values
          const impliedApy = lnRateToApy(state.lnImpliedRate);
          const days = daysToExpiry(info.expiry);
          const annualFeeRate = calculateAnnualFeeRate(lnFeeRateRootValue);

          // TVL = SY reserve (PT is also valued in SY terms)
          const tvlSy = state.syReserve + state.ptReserve;

          const baseData = {
            ...info,
            state,
            impliedApy,
            tvlSy,
            daysToExpiry: days,
            annualFeeRate,
            // TWAP fields - fallback to spot-only (useMarkets has full TWAP support)
            twapImpliedApy: impliedApy,
            spotImpliedApy: impliedApy,
            oracleState: 'spot-only' as const,
            twapDuration: 0,
          };

          // Get token metadata from static config if available
          const staticInfo = getMarketInfoByAddress(network, address);

          if (staticInfo) {
            return {
              ...baseData,
              metadata: {
                key: staticInfo.key,
                underlyingAddress: staticInfo.underlyingAddress,
                yieldTokenName: staticInfo.yieldTokenName,
                yieldTokenSymbol: staticInfo.yieldTokenSymbol,
                isERC4626: staticInfo.isERC4626,
                ...(staticInfo.initialAnchor !== undefined && {
                  initialAnchor: staticInfo.initialAnchor,
                }),
              },
            };
          }

          return baseData;
        } catch (error) {
          logError(error, {
            module: 'useMarket',
            action: 'fetchMarketData',
            marketAddress: address,
          });
          throw error;
        }
      },
      enabled: enabled && !!address,
      refetchInterval,
      staleTime: 10000,
      // Disable structural sharing to prevent BigInt serialization issues
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

/**
 * Hook to fetch basic market info (addresses, expiry) for a single market.
 * Lighter weight than useMarket - only fetches essential info.
 *
 * @param marketAddress - Accessor returning the market address or null
 */
export function useMarketInfo(marketAddress: Accessor<string | null>): UseMarketInfoReturn {
  const { provider, network } = useStarknet();

  const query = createQuery(() => {
    const address = marketAddress();
    return {
      queryKey: [...marketKeys.detail(address ?? '', network), 'info'] as const,
      queryFn: async (): Promise<MarketInfo> => {
        if (!address) {
          throw new Error('Market address is required');
        }

        const market = getMarketContract(address, provider);

        const [syAddress, ptAddress, ytAddress, expiry, isExpiredVal] = await Promise.all([
          market.sy(),
          market.pt(),
          market.yt(),
          market.expiry(),
          market.is_expired(),
        ]);

        return {
          address,
          syAddress: toHexAddress(syAddress),
          ptAddress: toHexAddress(ptAddress),
          ytAddress: toHexAddress(ytAddress),
          expiry: Number(expiry),
          isExpired: isExpiredVal,
        };
      },
      enabled: !!address,
      staleTime: 60000, // Info rarely changes, cache for 1 minute
    };
  });

  return {
    data: createMemo(() => query.data),
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError),
  };
}

/**
 * Hook to fetch market state (reserves, rates) for a single market.
 * Fetches more frequently changing data than useMarketInfo.
 *
 * @param marketAddress - Accessor returning the market address or null
 */
export function useMarketState(marketAddress: Accessor<string | null>): UseMarketStateReturn {
  const { provider, network } = useStarknet();

  const query = createQuery(() => {
    const address = marketAddress();
    return {
      queryKey: [...marketKeys.detail(address ?? '', network), 'state'] as const,
      queryFn: async (): Promise<MarketState & { impliedApy: BigNumber }> => {
        if (!address) {
          throw new Error('Market address is required');
        }

        const market = getMarketContract(address, provider);

        const [reserves, totalLpSupply, lnRate, feesCollected, lnFeeRateRoot, reserveFeePercent] =
          await Promise.all([
            market.get_reserves(),
            market.total_lp_supply(),
            market.get_ln_implied_rate(),
            market.get_total_fees_collected(),
            market.get_ln_fee_rate_root(),
            market.get_reserve_fee_percent(),
          ]);

        const reservesArr = reserves as unknown[];
        const lnImpliedRate = toBigInt(lnRate as bigint | { low: bigint; high: bigint });
        const lnFeeRateRootValue = toBigInt(
          lnFeeRateRoot as bigint | { low: bigint; high: bigint }
        );

        return {
          syReserve: toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint }),
          ptReserve: toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint }),
          totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }),
          lnImpliedRate,
          feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
          lnFeeRateRoot: lnFeeRateRootValue,
          reserveFeePercent: Number(reserveFeePercent),
          impliedApy: lnRateToApy(lnImpliedRate),
        };
      },
      enabled: !!address,
      refetchInterval: 15000, // State changes more frequently
      staleTime: 5000,
      // Disable structural sharing to prevent BigInt serialization issues
      structuralSharing: false,
    };
  });

  return {
    data: createMemo(() => query.data),
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError),
  };
}
