import type { APIEvent } from "@solidjs/start/server";
import { getMarketInfos } from "@shared/config/addresses";
import { getNetworkId, createProvider } from "@shared/starknet/provider";
import { getMarketFactoryContract } from "@shared/starknet/contracts";
import { logError, logWarn } from "@shared/server/logger";

/**
 * Markets List API Route
 *
 * GET /api/markets
 *
 * Returns a list of all active markets with their addresses and metadata.
 * Falls back to static config if on-chain fetch fails.
 */

const MARKETS_PAGE_SIZE = 20;

interface MarketListItem {
  address: string;
  ptAddress: string;
  ytAddress: string;
  syAddress: string;
  underlyingAddress: string;
  yieldTokenName: string;
  yieldTokenSymbol: string;
  isERC4626: boolean;
  expiry: number;
}

interface MarketsResponse {
  markets: MarketListItem[];
  network: string;
  timestamp: number;
}

interface ErrorResponse {
  error: string;
  code: string;
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
    },
  });
}

function errorResponse(message: string, code: string, status: number): Response {
  const data: ErrorResponse = { error: message, code };
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function addressToHex(addr: unknown): string {
  if (typeof addr === "bigint") {
    return `0x${addr.toString(16).padStart(64, "0")}`;
  }
  if (typeof addr === "string") {
    return addr;
  }
  return String(addr);
}

type PaginatedResult = { addresses: unknown[]; hasMore: boolean };
const EMPTY_PAGINATED_RESULT: PaginatedResult = { addresses: [], hasMore: false };

function tryParseArrayTuple(result: unknown): PaginatedResult | null {
  if (!Array.isArray(result) || result.length !== 2) return null;
  const [first, second] = result;
  if (!Array.isArray(first) || typeof second !== "boolean") return null;
  return { addresses: first, hasMore: second };
}

function tryParseNumericKeys(obj: Record<string, unknown>): PaginatedResult | null {
  if (!("0" in obj) || !("1" in obj)) return null;
  const addresses = obj["0"];
  if (!Array.isArray(addresses)) return null;
  return { addresses, hasMore: Boolean(obj["1"]) };
}

function tryParseNamedKeys(obj: Record<string, unknown>): PaginatedResult | null {
  if (!("addresses" in obj) && !("active_markets" in obj)) return null;
  const addresses = (obj["addresses"] ?? obj["active_markets"] ?? obj["markets"]) as unknown[];
  const hasMore = Boolean(obj["has_more"] ?? obj["hasMore"] ?? false);
  return { addresses: Array.isArray(addresses) ? addresses : [], hasMore };
}

function parsePaginatedResult(result: unknown): PaginatedResult {
  const arrayResult = tryParseArrayTuple(result);
  if (arrayResult) return arrayResult;

  if (result !== null && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    return tryParseNumericKeys(obj) ?? tryParseNamedKeys(obj) ?? EMPTY_PAGINATED_RESULT;
  }

  return EMPTY_PAGINATED_RESULT;
}

async function fetchActiveMarketAddresses(network: ReturnType<typeof getNetworkId>): Promise<string[]> {
  const provider = createProvider(network);
  const marketFactory = getMarketFactoryContract(provider, network);
  const allAddresses: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await marketFactory.get_active_markets_paginated(offset, MARKETS_PAGE_SIZE);
    const parsed = parsePaginatedResult(result);

    const pageAddresses = parsed.addresses
      .map(addressToHex)
      .filter(
        (addr) =>
          addr !== "0x0" &&
          addr !== "0x0000000000000000000000000000000000000000000000000000000000000000"
      );

    allAddresses.push(...pageAddresses);
    hasMore = parsed.hasMore;
    offset += MARKETS_PAGE_SIZE;

    // Safety limit
    if (offset > 1000) {
      logWarn("Reached safety limit of 1000 markets", { module: "api/markets" });
      break;
    }
  }

  return allAddresses;
}

export async function GET(_event: APIEvent): Promise<Response> {
  try {
    const network = getNetworkId();
    const staticMarkets = getMarketInfos(network);

    // Try to fetch on-chain market addresses
    let marketAddresses: string[] = [];
    try {
      marketAddresses = await fetchActiveMarketAddresses(network);
    } catch (err) {
      logWarn("Failed to fetch on-chain markets, using static config", {
        module: "api/markets",
        error: String(err),
      });
    }

    // Build response from static config, filtering by on-chain addresses if available
    let markets: MarketListItem[];

    if (marketAddresses.length > 0) {
      // Normalize addresses for comparison
      const normalizeAddr = (addr: string) => addr.toLowerCase().replace(/^0x0*/, "0x");
      const onChainSet = new Set(marketAddresses.map(normalizeAddr));

      markets = staticMarkets
        .filter((m) => onChainSet.has(normalizeAddr(m.marketAddress)))
        .map((m) => ({
          address: m.marketAddress,
          ptAddress: m.ptAddress,
          ytAddress: m.ytAddress,
          syAddress: m.syAddress,
          underlyingAddress: m.underlyingAddress,
          yieldTokenName: m.yieldTokenName,
          yieldTokenSymbol: m.yieldTokenSymbol,
          isERC4626: m.isERC4626,
          expiry: m.expiry,
        }));
    } else {
      // Fallback to all static markets
      markets = staticMarkets.map((m) => ({
        address: m.marketAddress,
        ptAddress: m.ptAddress,
        ytAddress: m.ytAddress,
        syAddress: m.syAddress,
        underlyingAddress: m.underlyingAddress,
        yieldTokenName: m.yieldTokenName,
        yieldTokenSymbol: m.yieldTokenSymbol,
        isERC4626: m.isERC4626,
        expiry: m.expiry,
      }));
    }

    const response: MarketsResponse = {
      markets,
      network,
      timestamp: Date.now(),
    };

    return jsonResponse(response);
  } catch (error) {
    logError(error, { module: "api/markets", action: "GET" });
    return errorResponse("Failed to fetch markets", "FETCH_ERROR", 500);
  }
}
