'use client';

import { useStarknet } from '@features/wallet';
import {
  getMarketContract,
  getPTContract,
  getRouterContract,
  getSYContract,
  getYTContract,
} from '@shared/starknet/contracts';
import { type UseQueryResult, useQueries, useQuery } from '@tanstack/react-query';

/**
 * Pause status checking hooks
 * @see Security Audit M-03 - Pausability Implementation
 *
 * All core contracts implement IPausable with is_paused().
 * These hooks allow the frontend to check pause status and
 * display appropriate warnings to users.
 */

interface UsePauseStatusOptions {
  /** Whether the query is enabled. Default: true */
  enabled?: boolean;
  /** Refetch interval in ms. Default: 30000 (30s) */
  refetchInterval?: number;
  /** Stale time in ms. Default: 10000 (10s) */
  staleTime?: number;
}

interface PauseStatusResult {
  isPaused: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to check pause status of the Router contract
 * This is the main entry point for all user transactions
 */
export function useRouterPauseStatus(options: UsePauseStatusOptions = {}): PauseStatusResult {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000, staleTime = 10000 } = options;
  const isClient = typeof window !== 'undefined';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pauseStatus', 'router', network],
    queryFn: async () => {
      const router = getRouterContract(provider, network);
      return router.is_paused();
    },
    enabled: isClient && enabled,
    refetchInterval,
    staleTime,
  });

  return {
    isPaused: data ?? false,
    isLoading,
    isError,
    error,
  };
}

/**
 * Hook to check pause status of a Market contract
 */
export function useMarketPauseStatus(
  marketAddress: string | null,
  options: UsePauseStatusOptions = {}
): PauseStatusResult {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 30000, staleTime = 10000 } = options;
  const isClient = typeof window !== 'undefined';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pauseStatus', 'market', marketAddress],
    queryFn: async () => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }
      const market = getMarketContract(marketAddress, provider);
      return market.is_paused();
    },
    enabled: isClient && enabled && !!marketAddress,
    refetchInterval,
    staleTime,
  });

  return {
    isPaused: data ?? false,
    isLoading,
    isError,
    error,
  };
}

/**
 * Hook to check pause status of SY, PT, and YT contracts for a market
 */
export function useTokenPauseStatus(
  addresses: {
    syAddress?: string | null;
    ptAddress?: string | null;
    ytAddress?: string | null;
  },
  options: UsePauseStatusOptions = {}
): {
  syPaused: boolean;
  ptPaused: boolean;
  ytPaused: boolean;
  anyPaused: boolean;
  isLoading: boolean;
  isError: boolean;
} {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 30000, staleTime = 10000 } = options;
  const isClient = typeof window !== 'undefined';

  const { syAddress, ptAddress, ytAddress } = addresses;

  const queries = useQueries({
    queries: [
      {
        queryKey: ['pauseStatus', 'sy', syAddress],
        queryFn: async () => {
          if (!syAddress) return false;
          const sy = getSYContract(syAddress, provider);
          return sy.is_paused();
        },
        enabled: isClient && enabled && !!syAddress,
        refetchInterval,
        staleTime,
      },
      {
        queryKey: ['pauseStatus', 'pt', ptAddress],
        queryFn: async () => {
          if (!ptAddress) return false;
          const pt = getPTContract(ptAddress, provider);
          return pt.is_paused();
        },
        enabled: isClient && enabled && !!ptAddress,
        refetchInterval,
        staleTime,
      },
      {
        queryKey: ['pauseStatus', 'yt', ytAddress],
        queryFn: async () => {
          if (!ytAddress) return false;
          const yt = getYTContract(ytAddress, provider);
          return yt.is_paused();
        },
        enabled: isClient && enabled && !!ytAddress,
        refetchInterval,
        staleTime,
      },
    ],
  });

  const [syQuery, ptQuery, ytQuery] = queries;

  const syPaused = syQuery.data ?? false;
  const ptPaused = ptQuery.data ?? false;
  const ytPaused = ytQuery.data ?? false;

  return {
    syPaused,
    ptPaused,
    ytPaused,
    anyPaused: syPaused || ptPaused || ytPaused,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

/**
 * Hook to check if any critical protocol component is paused
 * Useful for displaying a global pause warning
 */
export function useProtocolPauseStatus(options: UsePauseStatusOptions = {}): {
  routerPaused: boolean;
  anyPaused: boolean;
  isLoading: boolean;
  isError: boolean;
} {
  const { isPaused: routerPaused, isLoading, isError } = useRouterPauseStatus(options);

  return {
    routerPaused,
    anyPaused: routerPaused,
    isLoading,
    isError,
  };
}

/**
 * Generic hook to check pause status of any contract with IPausable interface
 * Use this for custom contracts not covered by the specific hooks above
 */
export function usePauseStatus(
  contractAddress: string | null,
  contractType: 'router' | 'market' | 'sy' | 'pt' | 'yt',
  options: UsePauseStatusOptions = {}
): UseQueryResult<boolean> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000, staleTime = 10000 } = options;
  const isClient = typeof window !== 'undefined';

  return useQuery({
    queryKey: ['pauseStatus', contractType, contractAddress],
    queryFn: async () => {
      if (!contractAddress) {
        throw new Error('Contract address is required');
      }

      switch (contractType) {
        case 'router': {
          const router = getRouterContract(provider, network);
          return router.is_paused();
        }
        case 'market': {
          const market = getMarketContract(contractAddress, provider);
          return market.is_paused();
        }
        case 'sy': {
          const sy = getSYContract(contractAddress, provider);
          return sy.is_paused();
        }
        case 'pt': {
          const pt = getPTContract(contractAddress, provider);
          return pt.is_paused();
        }
        case 'yt': {
          const yt = getYTContract(contractAddress, provider);
          return yt.is_paused();
        }
        default:
          throw new Error(`Unknown contract type: ${String(contractType)}`);
      }
    },
    enabled: isClient && enabled && !!contractAddress,
    refetchInterval,
    staleTime,
  });
}
