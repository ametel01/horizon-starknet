import { createQuery } from '@tanstack/solid-query';
import { type Accessor, createMemo } from 'solid-js';

/**
 * Raw rate data point from API
 */
export interface MarketRateDataPoint {
  timestamp: string;
  impliedRate: string;
  exchangeRate: string;
  // OHLC fields for daily resolution
  open?: string;
  high?: string;
  low?: string;
  close?: string;
}

/**
 * API response for market rates
 */
export interface MarketRatesResponse {
  market: string;
  resolution: 'tick' | 'daily';
  dataPoints: MarketRateDataPoint[];
}

/**
 * Processed rate data point for display
 */
export interface ProcessedRateDataPoint {
  timestamp: Date;
  displayDate: string;
  impliedRate: bigint;
  impliedRatePercent: number;
  exchangeRate: bigint;
  exchangeRateNum: number;
  // OHLC for daily resolution (in percent)
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

/**
 * Processed rates data for display
 */
export interface ProcessedRatesData {
  market: string;
  resolution: 'tick' | 'daily';
  dataPoints: ProcessedRateDataPoint[];
  // Computed stats
  currentRate: number;
  minRate: number;
  maxRate: number;
  avgRate: number;
  rateChange24h: number;
  rateChangePercent: number;
}

const WAD = BigInt(10) ** BigInt(18);

/**
 * Convert implied rate (WAD) to APY percentage
 *
 * The on-chain lnImpliedRate is ALREADY annualized:
 * lnImpliedRate = ln(exchangeRate) * SECONDS_PER_YEAR / timeToExpiry
 *
 * Therefore: APY = e^(ln_implied_rate) - 1 (no additional annualization needed)
 */
function impliedRateToApy(impliedRate: bigint): number {
  if (impliedRate === 0n) return 0;

  // Convert from WAD to decimal
  const rateDecimal = Number(impliedRate) / Number(WAD);

  // APY = exp(ln_implied_rate) - 1
  const apy = Math.exp(rateDecimal) - 1;

  return apy * 100; // Return as percentage
}

/**
 * Fetch rates data from the API
 */
async function fetchRatesData(
  marketAddress: string,
  resolution: 'tick' | 'daily',
  days: number
): Promise<MarketRatesResponse> {
  const params = new URLSearchParams({
    resolution,
    days: String(days),
  });

  const response = await fetch(`/api/markets/${marketAddress}/rates?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch rates: ${String(response.status)}`);
  }

  return response.json() as Promise<MarketRatesResponse>;
}

/**
 * Process raw rates response into usable format
 */
function processRatesData(data: MarketRatesResponse): ProcessedRatesData {
  const dataPoints: ProcessedRateDataPoint[] = data.dataPoints.map((point) => {
    const timestamp = new Date(point.timestamp);
    const impliedRate = BigInt(point.impliedRate);
    const exchangeRate = BigInt(point.exchangeRate);

    // lnImpliedRate is already annualized on-chain, no need for expiry-based calculation
    const impliedRatePercent = impliedRateToApy(impliedRate);
    const exchangeRateNum = Number(exchangeRate) / Number(WAD);

    const result: ProcessedRateDataPoint = {
      timestamp,
      displayDate: timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      impliedRate,
      impliedRatePercent,
      exchangeRate,
      exchangeRateNum,
    };

    // Add OHLC data for daily resolution
    if (
      point.open !== undefined &&
      point.high !== undefined &&
      point.low !== undefined &&
      point.close !== undefined
    ) {
      result.ohlc = {
        open: impliedRateToApy(BigInt(point.open)),
        high: impliedRateToApy(BigInt(point.high)),
        low: impliedRateToApy(BigInt(point.low)),
        close: impliedRateToApy(BigInt(point.close)),
      };
    }

    return result;
  });

  // Calculate stats
  const rates = dataPoints.map((p) => p.impliedRatePercent).filter((r) => r > 0);
  const currentRate = rates.length > 0 ? (rates[rates.length - 1] ?? 0) : 0;
  const minRate = rates.length > 0 ? Math.min(...rates) : 0;
  const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  // Calculate 24h change
  // Data is sorted oldest-first, so we iterate backwards to find the point closest to 24h ago
  let rateChange24h = 0;
  let rateChangePercent = 0;
  if (dataPoints.length >= 2) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    // Find the last point that is on or before 24h ago (iterate backwards for efficiency)
    let oldPoint: ProcessedRateDataPoint | undefined;
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const point = dataPoints[i];
      if (point && point.timestamp.getTime() <= oneDayAgo) {
        oldPoint = point;
        break;
      }
    }
    if (oldPoint) {
      rateChange24h = currentRate - oldPoint.impliedRatePercent;
      rateChangePercent =
        oldPoint.impliedRatePercent > 0 ? (rateChange24h / oldPoint.impliedRatePercent) * 100 : 0;
    }
  }

  return {
    market: data.market,
    resolution: data.resolution,
    dataPoints,
    currentRate,
    minRate,
    maxRate,
    avgRate,
    rateChange24h,
    rateChangePercent,
  };
}

export interface UseMarketRatesOptions {
  resolution?: Accessor<'tick' | 'daily'> | 'tick' | 'daily';
  days?: Accessor<number> | number;
  enabled?: Accessor<boolean> | boolean;
  refetchInterval?: number;
}

export interface UseMarketRatesReturn {
  data: Accessor<ProcessedRatesData | undefined>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  refetch: () => void;
}

/**
 * Query key factory for market rates
 */
export const marketRatesKeys = {
  all: ['market-rates'] as const,
  rates: (marketAddress: string, resolution: string, days: number) =>
    [...marketRatesKeys.all, marketAddress, resolution, days] as const,
};

/**
 * Hook to fetch market rate history
 *
 * @param marketAddress - Accessor returning the market contract address or null
 * @param options - Query options with reactive parameters
 * @returns Processed rate data with history and stats
 */
export function useMarketRates(
  marketAddress: Accessor<string | null>,
  options: UseMarketRatesOptions = {}
): UseMarketRatesReturn {
  const {
    resolution = 'daily',
    days = 30,
    enabled = true,
    refetchInterval = 60000,
  } = options;

  // Helper to unwrap accessor or plain value
  const unwrap = <T>(value: Accessor<T> | T): T =>
    typeof value === 'function' ? (value as Accessor<T>)() : value;

  const query = createQuery(() => {
    const address = marketAddress();
    const resolutionValue = unwrap(resolution);
    const daysValue = unwrap(days);
    const enabledValue = unwrap(enabled);

    return {
      queryKey: marketRatesKeys.rates(address ?? '', resolutionValue, daysValue),
      queryFn: async (): Promise<ProcessedRatesData> => {
        if (!address) {
          throw new Error('Market address required');
        }
        const data = await fetchRatesData(address, resolutionValue, daysValue);
        return processRatesData(data);
      },
      enabled: enabledValue && !!address,
      staleTime: 30000,
      refetchInterval,
      retry: 2,
      retryDelay: 5000,
      // Disable structural sharing to prevent BigInt serialization issues
      structuralSharing: false,
    };
  });

  return {
    data: createMemo(() => query.data),
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError),
    error: createMemo(() => query.error),
    refetch: () => query.refetch(),
  };
}
