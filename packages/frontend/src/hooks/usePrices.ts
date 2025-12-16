'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { TokenPrices } from '@/types/position';

/**
 * Fetch base token prices from CoinGecko or similar API
 */
async function fetchTokenPrices(): Promise<TokenPrices> {
  // In production, this would fetch from CoinGecko, Pragma, or another price oracle
  // For now, we use mock prices that can be replaced with real API calls

  try {
    // Attempt to fetch from CoinGecko (free tier)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=starknet,ethereum&vs_currencies=usd',
      {
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (response.ok) {
      const data = (await response.json()) as {
        starknet?: { usd?: number };
        ethereum?: { usd?: number };
      };

      const strkPrice = data.starknet?.usd ?? 0.5;
      const ethPrice = data.ethereum?.usd ?? 2000;

      // Derive LST prices from base prices with estimated premiums
      return {
        strk: strkPrice,
        eth: ethPrice,
        // nstSTRK trades at ~5% premium (staking yield)
        nstStrk: strkPrice * 1.05,
        // sSTRK trades at ~3% premium
        sStrk: strkPrice * 1.03,
        // wstETH trades at ~12% premium (accumulated staking yield)
        wstEth: ethPrice * 1.12,
      };
    }
  } catch (error) {
    // API call failed, use fallback prices
    console.warn('Failed to fetch token prices, using fallback:', error);
  }

  // Fallback mock prices for development/testing
  return {
    strk: 0.5,
    eth: 2000,
    nstStrk: 0.525, // 5% premium
    sStrk: 0.515, // 3% premium
    wstEth: 2240, // 12% premium
  };
}

interface UsePricesOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch current token prices
 */
export function usePrices(options: UsePricesOptions = {}): UseQueryResult<TokenPrices> {
  const { enabled = true, refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['token-prices'],
    queryFn: fetchTokenPrices,
    enabled,
    staleTime: 30000, // Consider stale after 30s
    refetchInterval,
    // Don't retry too aggressively on price API failures
    retry: 2,
    retryDelay: 5000,
  });
}

/**
 * Get SY price in USD based on underlying token
 */
export function getSyPriceUsd(
  yieldTokenSymbol: string | undefined,
  prices: TokenPrices | undefined
): number {
  if (!prices || !yieldTokenSymbol) {
    return 0;
  }

  // Map yield token symbols to prices
  const symbolLower = yieldTokenSymbol.toLowerCase();

  if (symbolLower.includes('nststrk')) {
    return prices.nstStrk;
  }

  if (symbolLower.includes('sstrk')) {
    return prices.sStrk;
  }

  if (symbolLower.includes('wsteth')) {
    return prices.wstEth;
  }

  if (symbolLower.includes('strk')) {
    return prices.strk;
  }

  if (symbolLower.includes('eth')) {
    return prices.eth;
  }

  // Default to STRK price for unknown tokens
  return prices.strk;
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
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `$${price.toFixed(2)}`;
}
