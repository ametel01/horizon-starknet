'use client';

import type { MarketData, MarketInfo, MarketState } from '@entities/market';
import { useStarknet } from '@features/wallet';
import { calculateAnnualFeeRate } from '@shared/lib/fees';
import { daysToExpiry, lnRateToApy } from '@shared/math/yield';
import { getMarketContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type BigNumber from 'bignumber.js';
import { uint256 } from 'starknet';

interface UseMarketOptions {
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

// Contract MarketState struct shape from get_market_state()
// Must match contracts/src/interfaces/i_market.cairo MarketState struct
interface ContractMarketState {
  sy_reserve: bigint | { low: bigint; high: bigint };
  pt_reserve: bigint | { low: bigint; high: bigint };
  total_lp: bigint | { low: bigint; high: bigint };
  scalar_root: bigint | { low: bigint; high: bigint };
  initial_anchor: bigint | { low: bigint; high: bigint };
  ln_fee_rate_root: bigint | { low: bigint; high: bigint };
  reserve_fee_percent: number | bigint;
  expiry: number | bigint;
  last_ln_implied_rate: bigint | { low: bigint; high: bigint };
  py_index: bigint | { low: bigint; high: bigint };
}

export function useMarket(
  marketAddress: string | null,
  options: UseMarketOptions = {}
): UseQueryResult<MarketData> {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['market', marketAddress],
    queryFn: async (): Promise<MarketData> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const market = getMarketContract(marketAddress, provider);

      // Use get_market_state() to reduce RPC calls from 11 to 6
      // get_market_state() returns: sy_reserve, pt_reserve, total_lp, scalar_root,
      // initial_anchor, ln_fee_rate_root, reserve_fee_percent, expiry, last_ln_implied_rate, py_index
      const [syAddress, ptAddress, ytAddress, isExpiredVal, contractState, feesCollected] =
        await Promise.all([
          market.sy(),
          market.pt(),
          market.yt(),
          market.is_expired(),
          market.get_market_state() as Promise<ContractMarketState>,
          market.get_total_fees_collected(),
        ]);

      const info: MarketInfo = {
        address: marketAddress,
        syAddress: toHexAddress(syAddress),
        ptAddress: toHexAddress(ptAddress),
        ytAddress: toHexAddress(ytAddress),
        expiry: Number(contractState.expiry),
        isExpired: Boolean(isExpiredVal),
      };

      const lnFeeRateRootValue = toBigInt(contractState.ln_fee_rate_root);
      const lnImpliedRate = toBigInt(contractState.last_ln_implied_rate);
      const state: MarketState = {
        syReserve: toBigInt(contractState.sy_reserve),
        ptReserve: toBigInt(contractState.pt_reserve),
        totalLpSupply: toBigInt(contractState.total_lp),
        lnImpliedRate,
        feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
        lnFeeRateRoot: lnFeeRateRootValue,
        reserveFeePercent: Number(contractState.reserve_fee_percent),
      };

      // Compute derived values
      const impliedApy = lnRateToApy(state.lnImpliedRate);
      const days = daysToExpiry(info.expiry);
      const annualFeeRate = calculateAnnualFeeRate(lnFeeRateRootValue);

      // TVL = SY reserve (PT is also valued in SY terms)
      const tvlSy = state.syReserve + state.ptReserve;

      return {
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
    },
    enabled: enabled && !!marketAddress,
    refetchInterval,
    staleTime: 10000, // Consider data stale after 10 seconds
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}

export function useMarketInfo(marketAddress: string | null): UseQueryResult<MarketInfo> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['market-info', marketAddress],
    queryFn: async (): Promise<MarketInfo> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const market = getMarketContract(marketAddress, provider);

      const [syAddress, ptAddress, ytAddress, expiry, isExpiredVal] = await Promise.all([
        market.sy(),
        market.pt(),
        market.yt(),
        market.expiry(),
        market.is_expired(),
      ]);

      return {
        address: marketAddress,
        syAddress: toHexAddress(syAddress),
        ptAddress: toHexAddress(ptAddress),
        ytAddress: toHexAddress(ytAddress),
        expiry: Number(expiry),
        isExpired: Boolean(isExpiredVal),
      };
    },
    enabled: !!marketAddress,
    staleTime: 60000, // Info rarely changes, cache for 1 minute
  });
}

export function useMarketState(
  marketAddress: string | null
): UseQueryResult<MarketState & { impliedApy: BigNumber }> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['market-state', marketAddress],
    queryFn: async (): Promise<MarketState & { impliedApy: BigNumber }> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const market = getMarketContract(marketAddress, provider);

      // Use get_market_state() to reduce RPC calls from 6 to 2
      // get_market_state() includes: last_ln_implied_rate, ln_fee_rate_root, reserves, etc.
      const [contractState, feesCollected] = await Promise.all([
        market.get_market_state() as Promise<ContractMarketState>,
        market.get_total_fees_collected(),
      ]);

      const lnImpliedRate = toBigInt(contractState.last_ln_implied_rate);
      const lnFeeRateRootValue = toBigInt(contractState.ln_fee_rate_root);

      return {
        syReserve: toBigInt(contractState.sy_reserve),
        ptReserve: toBigInt(contractState.pt_reserve),
        totalLpSupply: toBigInt(contractState.total_lp),
        lnImpliedRate,
        feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
        lnFeeRateRoot: lnFeeRateRootValue,
        reserveFeePercent: Number(contractState.reserve_fee_percent),
        impliedApy: lnRateToApy(lnImpliedRate),
      };
    },
    enabled: !!marketAddress,
    refetchInterval: 15000, // State changes more frequently
    staleTime: 5000,
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}
