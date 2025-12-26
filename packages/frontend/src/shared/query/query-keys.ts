/**
 * React Query Key Factory
 *
 * Centralized query key management for consistent cache invalidation
 * and type-safe query key references.
 *
 * @example
 * ```ts
 * import { queryKeys } from '@shared/query';
 *
 * // Use in useQuery
 * useQuery({
 *   queryKey: queryKeys.markets.detail(address),
 *   queryFn: () => fetchMarket(address),
 * });
 *
 * // Invalidate all market queries
 * queryClient.invalidateQueries({ queryKey: queryKeys.markets.all });
 *
 * // Invalidate specific market
 * queryClient.invalidateQueries({ queryKey: queryKeys.markets.detail(address) });
 * ```
 */

// ============================================================================
// Market Keys
// ============================================================================

export interface MarketListParams {
  activeOnly?: boolean;
}

export const marketKeys = {
  /** Base key for all market queries */
  all: ['market'] as const,

  /** List of markets with optional filters */
  list: (network: string) => [...marketKeys.all, 'list', network] as const,

  /** Paginated active markets */
  activePaginated: (network: string) => [...marketKeys.all, 'activePaginated', network] as const,

  /** Paginated all markets */
  allPaginated: (network: string) => [...marketKeys.all, 'allPaginated', network] as const,

  /** Market count */
  count: (network: string) => [...marketKeys.all, 'count', network] as const,

  /** Single market detail */
  detail: (address: string, network?: string) =>
    network
      ? ([...marketKeys.all, 'detail', address, network] as const)
      : ([...marketKeys.all, 'detail', address] as const),

  /** Market info (SY, PT, YT addresses) */
  info: (address: string) => [...marketKeys.all, 'info', address] as const,

  /** Market state (reserves, rates) */
  state: (address: string) => [...marketKeys.all, 'state', address] as const,

  /** Market rates history */
  rates: (address: string, resolution?: string, days?: number) =>
    [...marketKeys.all, 'rates', address, { resolution, days }] as const,
} as const;

// ============================================================================
// Token Keys
// ============================================================================

export const tokenKeys = {
  /** Base key for all token queries */
  all: ['token'] as const,

  /** Token balance for address */
  balance: (tokenAddress: string, userAddress: string) =>
    [...tokenKeys.all, 'balance', tokenAddress, userAddress] as const,

  /** Token allowance */
  allowance: (tokenAddress: string, userAddress: string, spenderAddress: string) =>
    [...tokenKeys.all, 'allowance', tokenAddress, userAddress, spenderAddress] as const,

  /** Token info (name, symbol, decimals) */
  info: (tokenAddress: string) => [...tokenKeys.all, 'info', tokenAddress] as const,

  /** LP token balance */
  lpBalance: (marketAddress: string, userAddress: string) =>
    [...tokenKeys.all, 'lp', marketAddress, userAddress] as const,
} as const;

// ============================================================================
// Position Keys
// ============================================================================

export const positionKeys = {
  /** Base key for all position queries */
  all: ['positions'] as const,

  /** User positions across markets */
  list: (userAddress: string, marketAddresses?: string) =>
    [...positionKeys.all, userAddress, marketAddresses] as const,

  /** Check if user has position in market */
  hasPosition: (userAddress: string, marketAddress: string) =>
    [...positionKeys.all, 'has', userAddress, marketAddress] as const,
} as const;

// ============================================================================
// User Keys
// ============================================================================

export const userKeys = {
  /** Base key for all user queries */
  all: ['user'] as const,

  /** User yield history */
  yield: (address: string, days?: number) => [...userKeys.all, 'yield', address, { days }] as const,
} as const;

// ============================================================================
// Protocol Keys
// ============================================================================

export const protocolKeys = {
  /** Base key for all protocol queries */
  all: ['protocol'] as const,

  /** Protocol volume */
  volume: (days?: number) => [...protocolKeys.all, 'volume', { days }] as const,

  /** Pause status */
  pauseStatus: (contractType: string, contractAddress?: string) =>
    contractAddress
      ? ([...protocolKeys.all, 'pauseStatus', contractType, contractAddress] as const)
      : ([...protocolKeys.all, 'pauseStatus', contractType] as const),
} as const;

// ============================================================================
// SY (Standardized Yield) Keys
// ============================================================================

export const syKeys = {
  /** Base key for all SY queries */
  all: ['sy'] as const,

  /** Underlying token info */
  underlying: (syAddress: string) => [...syKeys.all, 'underlying', syAddress] as const,
} as const;

// ============================================================================
// Indexer Keys (API-backed queries)
// ============================================================================

const INDEXER_BASE = ['indexer'] as const;

export const indexerKeys = {
  /** Base key for all indexer queries */
  all: INDEXER_BASE,

  /** Indexer health status */
  health: () => [...INDEXER_BASE, 'health'] as const,

  /** Markets from indexer */
  markets: {
    all: [...INDEXER_BASE, 'markets'] as const,
    list: (params?: { activeOnly?: boolean }) =>
      [...INDEXER_BASE, 'markets', params ?? {}] as const,
    detail: (address: string) => [...INDEXER_BASE, 'market', address] as const,
    swaps: (address: string, params?: { limit?: number; since?: string | undefined }) =>
      [...INDEXER_BASE, 'market', address, 'swaps', params ?? {}] as const,
    tvl: (address: string, params?: { days?: number }) =>
      [...INDEXER_BASE, 'market', address, 'tvl', params ?? {}] as const,
    rates: (address: string, params?: { days?: number }) =>
      [...INDEXER_BASE, 'market', address, 'rates', params ?? {}] as const,
  },

  /** Analytics from indexer */
  analytics: {
    all: [...INDEXER_BASE, 'analytics'] as const,
    stats: () => [...INDEXER_BASE, 'analytics', 'stats'] as const,
    tvl: (params?: { days?: number }) =>
      [...INDEXER_BASE, 'analytics', 'tvl', params ?? {}] as const,
    volume: (params?: { days?: number }) =>
      [...INDEXER_BASE, 'analytics', 'volume', params ?? {}] as const,
    fees: (params?: { days?: number }) =>
      [...INDEXER_BASE, 'analytics', 'fees', params ?? {}] as const,
  },

  /** User data from indexer */
  users: {
    all: [...INDEXER_BASE, 'user'] as const,
    history: (
      address: string | undefined | null,
      params?: { types?: string | undefined; limit?: number }
    ) => [...INDEXER_BASE, 'user', address, 'history', params ?? {}] as const,
    positions: (address: string | undefined | null) =>
      [...INDEXER_BASE, 'user', address, 'positions'] as const,
    yield: (
      address: string | undefined | null,
      params?: { days?: number | undefined; limit?: number }
    ) => [...INDEXER_BASE, 'user', address, 'yield', params ?? {}] as const,
    portfolioHistory: (
      address: string | undefined | null,
      params?: { days?: number; limit?: number }
    ) => [...INDEXER_BASE, 'user', address, 'portfolio-history', params ?? {}] as const,
  },
} as const;

// ============================================================================
// Combined Query Keys Export
// ============================================================================

/**
 * Centralized query key factory
 *
 * Use these keys for all React Query operations to ensure
 * consistent cache management and invalidation.
 */
export const queryKeys = {
  markets: marketKeys,
  tokens: tokenKeys,
  positions: positionKeys,
  users: userKeys,
  protocol: protocolKeys,
  sy: syKeys,
  indexer: indexerKeys,
} as const;

// ============================================================================
// Query Invalidation Helpers
// ============================================================================

/**
 * Common invalidation patterns for mutations
 */
export const invalidationPatterns = {
  /** After a swap - invalidate balances, market state, positions */
  afterSwap: (marketAddress: string, _userAddress: string) => [
    { queryKey: tokenKeys.all },
    { queryKey: marketKeys.state(marketAddress) },
    { queryKey: positionKeys.all },
  ],

  /** After adding/removing liquidity */
  afterLiquidity: (marketAddress: string, _userAddress: string) => [
    { queryKey: tokenKeys.all },
    { queryKey: marketKeys.state(marketAddress) },
    { queryKey: positionKeys.all },
  ],

  /** After minting PT/YT */
  afterMint: (_userAddress: string) => [
    { queryKey: tokenKeys.all },
    { queryKey: positionKeys.all },
  ],

  /** After redeeming PT/YT */
  afterRedeem: (_userAddress: string) => [
    { queryKey: tokenKeys.all },
    { queryKey: positionKeys.all },
  ],

  /** After claiming yield */
  afterClaimYield: (_userAddress: string) => [
    { queryKey: tokenKeys.all },
    { queryKey: positionKeys.all },
    { queryKey: userKeys.all },
  ],
} as const;
