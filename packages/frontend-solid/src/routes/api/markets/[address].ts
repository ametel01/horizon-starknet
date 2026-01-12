import type { APIEvent } from "@solidjs/start/server";
import { getMarketInfoByAddress } from "@shared/config/addresses";
import { getNetworkId, createProvider } from "@shared/starknet/provider";
import { getMarketContract } from "@shared/starknet/contracts";
import { logError } from "@shared/server/logger";
import { uint256 } from "starknet";

/**
 * Single Market API Route
 *
 * GET /api/markets/[address]
 *
 * Returns detailed market data for a specific market address.
 */

interface MarketResponse {
  address: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  expiry: number;
  isExpired: boolean;
  state: {
    syReserve: string;
    ptReserve: string;
    totalLpSupply: string;
    lnImpliedRate: string;
    feesCollected: string;
    lnFeeRateRoot: string;
    reserveFeePercent: number;
  };
  tvlSy: string;
  metadata?: {
    key: string;
    underlyingAddress: string;
    yieldTokenName: string;
    yieldTokenSymbol: string;
    isERC4626: boolean;
  };
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
      "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
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

function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  return uint256.uint256ToBN(value);
}

function toHexAddress(value: unknown): string {
  if (typeof value === "bigint") {
    return `0x${value.toString(16).padStart(64, "0")}`;
  }
  return String(value);
}

function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(address);
}

export async function GET(event: APIEvent): Promise<Response> {
  const { params } = event;
  const address = params["address"];

  if (!address) {
    return errorResponse("Market address is required", "MISSING_ADDRESS", 400);
  }

  if (!isValidAddress(address)) {
    return errorResponse("Invalid market address format", "INVALID_ADDRESS", 400);
  }

  try {
    const network = getNetworkId();
    const provider = createProvider(network);
    const market = getMarketContract(address, provider);

    // Fetch all market data in parallel
    const [
      syAddress,
      ptAddress,
      ytAddress,
      expiry,
      isExpiredVal,
      reserves,
      totalLpSupply,
      lnRate,
      feesCollected,
      lnFeeRateRoot,
      reserveFeePercent,
    ] = await Promise.all([
      market.sy(),
      market.pt(),
      market.yt(),
      market.expiry(),
      market.is_expired(),
      market.get_reserves(),
      market.total_lp_supply(),
      market.get_ln_implied_rate(),
      market.get_total_fees_collected(),
      market.get_ln_fee_rate_root(),
      market.get_reserve_fee_percent(),
    ]);

    const reservesArr = reserves as unknown[];
    const syReserve = toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint });
    const ptReserve = toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint });
    const tvlSy = syReserve + ptReserve;

    // Get metadata from static config if available
    const staticInfo = getMarketInfoByAddress(network, address);

    const response: MarketResponse = {
      address,
      syAddress: toHexAddress(syAddress),
      ptAddress: toHexAddress(ptAddress),
      ytAddress: toHexAddress(ytAddress),
      expiry: Number(expiry),
      isExpired: isExpiredVal,
      state: {
        syReserve: syReserve.toString(),
        ptReserve: ptReserve.toString(),
        totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }).toString(),
        lnImpliedRate: toBigInt(lnRate as bigint | { low: bigint; high: bigint }).toString(),
        feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }).toString(),
        lnFeeRateRoot: toBigInt(lnFeeRateRoot as bigint | { low: bigint; high: bigint }).toString(),
        reserveFeePercent: Number(reserveFeePercent),
      },
      tvlSy: tvlSy.toString(),
      network,
      timestamp: Date.now(),
    };

    if (staticInfo) {
      response.metadata = {
        key: staticInfo.key,
        underlyingAddress: staticInfo.underlyingAddress,
        yieldTokenName: staticInfo.yieldTokenName,
        yieldTokenSymbol: staticInfo.yieldTokenSymbol,
        isERC4626: staticInfo.isERC4626,
      };
    }

    return jsonResponse(response);
  } catch (error) {
    logError(error, { module: "api/markets/[address]", action: "GET", address });

    // Check if it's a contract not found error
    const errorMessage = String(error);
    if (errorMessage.includes("Contract not found") || errorMessage.includes("StarknetErrorCode.UNINITIALIZED_CONTRACT")) {
      return errorResponse("Market not found", "NOT_FOUND", 404);
    }

    return errorResponse("Failed to fetch market data", "FETCH_ERROR", 500);
  }
}
