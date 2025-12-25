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

// JSON-RPC response type
interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string };
  id: string | number | null;
}

export async function POST(request: NextRequest): Promise<NextResponse<JsonRpcResponse>> {
  if (!RPC_URL) {
    logError(new Error('RPC_URL not configured'), { module: 'api/rpc' });
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'RPC not configured' }, id: null },
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
