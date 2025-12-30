'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { logWarn } from '@shared/server/logger';

const AVNU_PRICES_API = 'https://starknet.impulse.avnu.fi/v3/tokens/prices';

/**
 * Known token addresses for price lookups
 * When we have mock/test tokens, we can map them to real token addresses
 */
const TOKEN_ADDRESS_MAP: Record<string, string> = {
  // sSTRK (Staked STRK by Nimbora)
  sSTRK: '0x356f304b154d29d2a8fe22f1cb9107a9b564a733cf6b4cc47fd121ac1af90c9',
  // STRK native token
  STRK: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  // wstETH
  wstETH: '0x042b8f0484674ca266ac5d08e4ac6a3fe65bd3129795def2dca5c34ecc5f96d2',
};

/**
 * Map mock/test token symbols to real token addresses for pricing
 */
export function getTokenAddressForPricing(symbol: string | undefined): string | undefined {
  if (!symbol) return undefined;
  const s = symbol.toLowerCase();

  // Map horizon mock tokens to real equivalents
  if (s.includes('hrzstrk') || s.includes('sstrk') || s.includes('nststrk')) {
    return TOKEN_ADDRESS_MAP['sSTRK'];
  }
  if (s.includes('wsteth')) {
    return TOKEN_ADDRESS_MAP['wstETH'];
  }
  if (s.includes('strk')) {
    return TOKEN_ADDRESS_MAP['STRK'];
  }

  return undefined;
}

/**
 * AVNU token price response
 */
interface AvnuTokenPrice {
  address: string;
  decimals: number;
  globalMarket: { usd: number } | null;
  starknetMarket: { usd: number } | null;
}

/**
 * Normalize Starknet address to lowercase with 0x prefix and no leading zeros.
 * AVNU API returns addresses without leading zeros, so we need to strip them
 * for consistent lookups.
 */
function normalizeAddress(address: string): string {
  // Remove 0x prefix, lowercase, strip leading zeros, then re-add prefix
  const hex = address.toLowerCase().replace(/^0x/, '').replace(/^0+/, '');
  return '0x' + (hex || '0'); // Ensure at least '0x0' for zero address
}

/**
 * Fetch token prices from AVNU API
 */
async function fetchTokenPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  if (tokenAddresses.length === 0) {
    return priceMap;
  }

  try {
    const response = await fetch(AVNU_PRICES_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens: tokenAddresses }),
    });

    if (!response.ok) {
      logWarn('AVNU API error', { module: 'usePrices', status: response.status });
      return priceMap;
    }

    const prices = (await response.json()) as AvnuTokenPrice[];

    for (const price of prices) {
      // Prefer global market price (CoinGecko) as it's more accurate for token value
      // Fall back to on-chain Starknet market price if global not available
      const usdPrice = price.globalMarket?.usd ?? price.starknetMarket?.usd ?? 0;
      // Normalize address to lowercase for consistent lookups
      const normalizedAddr = normalizeAddress(price.address);
      priceMap.set(normalizedAddr, usdPrice);
    }
  } catch (error) {
    logWarn('Failed to fetch token prices from AVNU', {
      module: 'usePrices',
      error: String(error),
    });
  }

  return priceMap;
}

interface UsePricesOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch token prices from AVNU
 *
 * @param tokenAddresses - Array of token contract addresses to fetch prices for
 * @param options - Query options
 * @returns Map of token address -> USD price
 */
export function usePrices(
  tokenAddresses: string[],
  options: UsePricesOptions = {}
): UseQueryResult<Map<string, number>> {
  const { enabled = true, refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['token-prices', tokenAddresses.sort().join(',')],
    queryFn: () => fetchTokenPrices(tokenAddresses),
    enabled: enabled && tokenAddresses.length > 0,
    staleTime: 30000, // Consider stale after 30s
    refetchInterval,
    retry: 2,
    retryDelay: 5000,
  });
}

/**
 * Get price for a specific token address from the price map
 */
export function getTokenPrice(
  tokenAddress: string | undefined,
  prices: Map<string, number> | undefined
): number {
  if (!prices || !tokenAddress) {
    return 0;
  }
  return prices.get(normalizeAddress(tokenAddress)) ?? 0;
}

/**
 * Format a price for display
 */
export function formatPrice(price: number): string {
  if (price === 0) {
    return '$0.00';
  }

  if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  }

  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }

  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `$${price.toFixed(2)}`;
}
