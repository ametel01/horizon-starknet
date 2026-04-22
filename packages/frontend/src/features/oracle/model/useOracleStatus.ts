'use client';

import { useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import {
  TWAP_DEFAULT_DURATION,
  TWAP_DURATIONS,
  TWAP_REFETCH_INTERVAL,
  TWAP_STALE_TIME,
} from '@shared/config/twap';
import { toBigInt } from '@shared/lib';
import { lnRateToApy } from '@shared/math/yield';
import { logError, logWarn } from '@shared/server/logger';
import { getMarketContract, getPyLpOracleContract } from '@shared/starknet/contracts';
import { useQuery } from '@tanstack/react-query';

import type { OracleStatus } from './types';

/**
 * Calculate estimated time until TWAP oracle is ready.
 * Uses a heuristic of ~10s per block to estimate when enough
 * observations will be accumulated.
 */
function calculateEstimatedReadyIn(cardinality: number, requestedDuration: number): string {
  const needed = Math.ceil(requestedDuration / 10); // ~10s per block
  const remaining = Math.max(0, needed - cardinality);
  const estimatedMinutes = Math.ceil((remaining * 10) / 60);

  if (estimatedMinutes <= 0) {
    return 'Almost ready';
  }
  if (estimatedMinutes > 60) {
    return `~${Math.ceil(estimatedMinutes / 60)} hrs`;
  }
  return `~${estimatedMinutes} min`;
}

/**
 * Get oracle status and best available rate for a market
 *
 * Implements graceful degradation:
 * 1. Try full TWAP at requested duration
 * 2. Fall back to shorter TWAP (1/3 of requested)
 * 3. Fall back to spot rate with indicator
 *
 * @param marketAddress - The market contract address
 * @param requestedDuration - TWAP duration in seconds (default: 900 = 15 min)
 */
export function useOracleStatus(
  marketAddress: string | undefined,
  requestedDuration: number = TWAP_DEFAULT_DURATION
) {
  const { provider, network } = useStarknet();
  const addresses = getAddresses(network);
  const isClient = typeof window !== 'undefined';

  return useQuery({
    queryKey: ['oracleStatus', marketAddress, requestedDuration, network],
    queryFn: async (): Promise<OracleStatus> => {
      if (!marketAddress) {
        throw new Error('Market address required');
      }

      try {
        // Check if PyLpOracle is configured
        if (!addresses.pyLpOracle || addresses.pyLpOracle === '0x0') {
          // Fall back to spot rate when PyLpOracle not available
          const market = getMarketContract(marketAddress, provider);
          const oracleState = await market.get_oracle_state();
          const spotRate = toBigInt(oracleState.last_ln_implied_rate);
          const apy = lnRateToApy(spotRate).toNumber();

          return {
            state: 'spot-only',
            rate: spotRate,
            apy,
            estimatedReadyIn: 'PyLpOracle not configured',
          };
        }

        const pyLpOracle = getPyLpOracleContract(addresses.pyLpOracle, provider);
        const market = getMarketContract(marketAddress, provider);

        // Check if full TWAP is available
        const readiness = await pyLpOracle.check_oracle_state(marketAddress, requestedDuration);

        if (readiness.oldest_observation_satisfied) {
          const rawRate = await pyLpOracle.get_ln_implied_rate_twap(
            marketAddress,
            requestedDuration
          );
          const rate = toBigInt(rawRate);
          const apy = lnRateToApy(rate).toNumber();
          return { state: 'ready', rate, duration: requestedDuration, apy };
        }

        // Try shorter duration (1/3 of requested, minimum 5 min)
        const shortDuration = Math.max(Math.floor(requestedDuration / 3), TWAP_DURATIONS.MINIMUM);
        const shortReadiness = await pyLpOracle.check_oracle_state(marketAddress, shortDuration);

        if (shortReadiness.oldest_observation_satisfied) {
          const rawRate = await pyLpOracle.get_ln_implied_rate_twap(marketAddress, shortDuration);
          const rate = toBigInt(rawRate);
          const apy = lnRateToApy(rate).toNumber();
          return {
            state: 'partial',
            rate,
            availableDuration: shortDuration,
            requestedDuration,
            apy,
          };
        }

        // Fall back to spot rate
        const oracleState = await market.get_oracle_state();
        const spotRate = toBigInt(oracleState.last_ln_implied_rate);
        const apy = lnRateToApy(spotRate).toNumber();
        const cardinality = Number(oracleState.observation_cardinality);
        const estimatedReadyIn = calculateEstimatedReadyIn(cardinality, requestedDuration);

        logWarn('TWAP not yet available, using spot rate', {
          module: 'oracle',
          marketAddress,
          cardinality,
          estimatedReadyIn,
        });

        return { state: 'spot-only', rate: spotRate, apy, estimatedReadyIn };
      } catch (error) {
        logError(error, {
          module: 'oracle',
          action: 'useOracleStatus',
          marketAddress,
          requestedDuration,
        });
        throw error;
      }
    },
    staleTime: TWAP_STALE_TIME,
    refetchInterval: TWAP_REFETCH_INTERVAL,
    enabled: isClient && !!marketAddress,
  });
}
