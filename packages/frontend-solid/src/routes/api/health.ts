import { logError } from '@shared/server/logger';
import { createProvider, getNetworkId } from '@shared/starknet/provider';
import type { APIEvent } from '@solidjs/start/server';

/**
 * Health Check Route
 *
 * Returns service health status for monitoring systems.
 * Used by load balancers, container orchestrators, and uptime monitors.
 *
 * Checks:
 * - Basic server responsiveness
 * - RPC provider connectivity (optional, degraded if unavailable)
 */

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  network: string;
  timestamp: number;
  checks?: {
    rpc?: 'ok' | 'error';
  };
}

interface ErrorResponse {
  status: 'error';
  error: string;
  timestamp: number;
}

export async function GET(_event: APIEvent): Promise<Response> {
  try {
    const network = getNetworkId();
    let rpcStatus: 'ok' | 'error' = 'ok';

    // Check RPC connectivity by getting chain ID
    try {
      const provider = createProvider(network);
      await provider.getChainId();
    } catch {
      rpcStatus = 'error';
    }

    const response: HealthResponse = {
      status: rpcStatus === 'ok' ? 'ok' : 'degraded',
      network,
      timestamp: Date.now(),
      checks: {
        rpc: rpcStatus,
      },
    };

    return new Response(JSON.stringify(response), {
      status: rpcStatus === 'ok' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    logError(error, { module: 'api/health', action: 'GET' });

    const response: ErrorResponse = {
      status: 'error',
      error: 'Health check failed',
      timestamp: Date.now(),
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
