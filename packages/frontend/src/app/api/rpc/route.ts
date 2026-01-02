import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * RPC Proxy Route
 *
 * Proxies JSON-RPC requests to the Starknet RPC endpoint.
 * This keeps the RPC URL (with API key) server-side only.
 *
 * Security measures:
 * - URL allowlist to prevent SSRF attacks
 * - Request timeout to prevent hanging connections
 * - Input size limit to prevent DoS
 */

// Server-side only RPC URL (no NEXT_PUBLIC_ prefix)
const RPC_URL = process.env['RPC_URL'];

// Maximum request body size (10KB)
const MAX_BODY_SIZE = 10_000;

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Allowed RPC hosts for SSRF prevention
 * Only these hosts can be proxied to, preventing misconfiguration attacks
 */
const ALLOWED_RPC_HOSTS = [
  // Alchemy
  'starknet-mainnet.g.alchemy.com',
  'starknet-sepolia.g.alchemy.com',
  // Infura
  'starknet-mainnet.infura.io',
  'starknet-sepolia.infura.io',
  // Local development
  'localhost',
  '127.0.0.1',
];

/**
 * Validate that the RPC URL is in the allowlist
 */
function isAllowedRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_RPC_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

// JSON-RPC response type
interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string };
  id: string | number | null;
}

export async function POST(request: NextRequest): Promise<NextResponse<JsonRpcResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'RPC');
  if (rateLimitResult) return rateLimitResult as NextResponse<JsonRpcResponse>;

  // Check input size limit
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Request too large' }, id: null },
      { status: 413 }
    );
  }

  // Check RPC URL is configured
  if (!RPC_URL) {
    logError(new Error('RPC_URL not configured'), { module: 'api/rpc' });
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'RPC not configured' }, id: null },
      { status: 500 }
    );
  }

  // Validate RPC URL against allowlist (SSRF prevention)
  if (!isAllowedRpcUrl(RPC_URL)) {
    logError(new Error(`RPC_URL not in allowlist: ${new URL(RPC_URL).hostname}`), {
      module: 'api/rpc',
    });
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Invalid RPC configuration' }, id: null },
      { status: 500 }
    );
  }

  try {
    const body: unknown = await request.json();

    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = (await response.json()) as JsonRpcResponse;

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32603, message: 'Request timeout' }, id: null },
        { status: 504 }
      );
    }

    logError(error, { module: 'api/rpc' });
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null },
      { status: 500 }
    );
  }
}
