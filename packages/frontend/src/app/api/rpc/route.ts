import { NextRequest, NextResponse } from 'next/server';

import { logError } from '@/lib/logger';

/**
 * RPC Proxy Route
 *
 * Proxies JSON-RPC requests to the Starknet RPC endpoint.
 * This keeps the RPC URL (with API key) server-side only.
 */

// Server-side only RPC URL (no NEXT_PUBLIC_ prefix)
const RPC_URL = process.env.RPC_URL;

// Default public RPC as fallback
const DEFAULT_RPC_URL = 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7';

// JSON-RPC request/response types
interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: unknown[];
  id: string | number | null;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string };
  id: string | number | null;
}

export async function POST(request: NextRequest): Promise<NextResponse<JsonRpcResponse>> {
  const rpcUrl = RPC_URL ?? DEFAULT_RPC_URL;

  try {
    const body = (await request.json()) as JsonRpcRequest;

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as JsonRpcResponse;

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logError(error, { module: 'api/rpc' });
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null },
      { status: 500 }
    );
  }
}
