import type { HealthResponse } from '@shared/api/types';

export interface IndexerState {
  lastIndexedBlock: number | null;
  currentChainBlock: number | null;
  lagBlocks: number | null;
  error: string | null;
}

export const EMPTY_INDEXER_STATE: IndexerState = {
  lastIndexedBlock: null,
  currentChainBlock: null,
  lagBlocks: null,
  error: null,
};

export function deriveHealthStatus(
  connected: boolean,
  indexerState: IndexerState
): HealthResponse['status'] {
  if (!connected) return 'unhealthy';
  if (indexerState.error) return 'degraded';
  if (indexerState.currentChainBlock === null) return 'degraded';
  if (indexerState.lagBlocks !== null && indexerState.lagBlocks > 100) return 'degraded';
  return 'healthy';
}

export function getHealthRpcUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  return env['RPC_URL'] ?? null;
}

export async function getCurrentStarknetBlock(
  fetcher: typeof fetch = fetch,
  timeoutMs = 5000
): Promise<number | null> {
  const rpcUrl = getHealthRpcUrl();
  if (!rpcUrl) return null;

  try {
    const response = await fetcher(rpcUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'starknet_blockNumber',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { result?: unknown };
    return typeof data.result === 'number' ? data.result : null;
  } catch {
    return null;
  }
}
