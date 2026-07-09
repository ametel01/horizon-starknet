import { describe, expect, test } from 'bun:test';

import { deriveHealthStatus, getHealthRpcUrl } from './health-utils';

describe('health status derivation', () => {
  test('degrades when chain head is unknown', () => {
    expect(
      deriveHealthStatus(true, {
        lastIndexedBlock: 100,
        currentChainBlock: null,
        lagBlocks: null,
        error: null,
      })
    ).toBe('degraded');
  });

  test('stays healthy when database is connected and lag is acceptable', () => {
    expect(
      deriveHealthStatus(true, {
        lastIndexedBlock: 100,
        currentChainBlock: 110,
        lagBlocks: 10,
        error: null,
      })
    ).toBe('healthy');
  });

  test('degrades when indexer lag exceeds threshold', () => {
    expect(
      deriveHealthStatus(true, {
        lastIndexedBlock: 100,
        currentChainBlock: 250,
        lagBlocks: 150,
        error: null,
      })
    ).toBe('degraded');
  });

  test('is unhealthy when database is disconnected', () => {
    expect(
      deriveHealthStatus(false, {
        lastIndexedBlock: null,
        currentChainBlock: null,
        lagBlocks: null,
        error: null,
      })
    ).toBe('unhealthy');
  });
});

describe('health RPC configuration', () => {
  test('uses server-only RPC_URL', () => {
    expect(
      getHealthRpcUrl({
        RPC_URL: 'https://rpc.example',
        NEXT_PUBLIC_RPC_URL: 'https://public.example',
      })
    ).toBe('https://rpc.example');
  });

  test('does not fall back to NEXT_PUBLIC_RPC_URL', () => {
    expect(getHealthRpcUrl({ NEXT_PUBLIC_RPC_URL: 'https://public.example' })).toBeNull();
  });
});
