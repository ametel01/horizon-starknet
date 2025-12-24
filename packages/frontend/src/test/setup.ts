/**
 * Test Setup and Utilities
 *
 * Provides mock providers and utilities for testing React hooks and components.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, createElement } from 'react';

/**
 * Create a test query client with disabled retries and caching
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Create a wrapper component with QueryClientProvider
 */
export function createQueryWrapper(): React.FC<{ children: ReactNode }> {
  const queryClient = createTestQueryClient();
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * Mock Starknet provider for testing
 */
export const mockProvider = {
  getChainId: (): Promise<'0x534e5f5345504f4c4941'> => Promise.resolve('0x534e5f5345504f4c4941'), // SN_SEPOLIA
  callContract: (): Promise<{ result: string[] }> => Promise.resolve({ result: ['0x0'] }),
  getBlock: (): Promise<{ block_number: number }> => Promise.resolve({ block_number: 12345 }),
  waitForTransaction: (): Promise<{ execution_status: string }> =>
    Promise.resolve({ execution_status: 'SUCCEEDED' }),
};

/**
 * Mock Starknet account for testing
 */
export const mockAccount = {
  address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  execute: (): Promise<{ transaction_hash: string }> =>
    Promise.resolve({ transaction_hash: '0xabc123' }),
  signMessage: (): Promise<string[]> => Promise.resolve(['0x1', '0x2']),
};

/**
 * Mock market data for testing
 */
export const mockMarketData = {
  address: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  syAddress: '0x1111111111111111111111111111111111111111111111111111111111111111',
  ptAddress: '0x2222222222222222222222222222222222222222222222222222222222222222',
  ytAddress: '0x3333333333333333333333333333333333333333333333333333333333333333',
  expiry: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year from now
  isExpired: false,
  state: {
    syReserve: 1000000n * 10n ** 18n,
    ptReserve: 1000000n * 10n ** 18n,
    totalLpSupply: 2000000n * 10n ** 18n,
    lnImpliedRate: 50000000000000000n, // 5%
    feesCollected: 1000n * 10n ** 18n,
  },
  metadata: {
    key: 'test-market',
    underlyingAddress: '0x4444444444444444444444444444444444444444444444444444444444444444',
    yieldTokenName: 'Test Yield Token',
    yieldTokenSymbol: 'TYT',
    isERC4626: true,
  },
};

/**
 * Mock wallet connection state
 */
export const mockWalletState = {
  connected: true,
  address: mockAccount.address,
  chainId: '0x534e5f5345504f4c4941',
};

/**
 * WAD constant for test calculations
 */
export const WAD = 10n ** 18n;

/**
 * Create mock balance (in WAD)
 */
export function mockBalance(amount: number): bigint {
  return BigInt(Math.floor(amount * 1e18));
}
