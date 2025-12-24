'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { MarketRatesResponse } from './api/types';

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
      displayDate: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
  let rateChange24h = 0;
  let rateChangePercent = 0;
  if (dataPoints.length >= 2) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const oldPoint = dataPoints.find((p) => p.timestamp.getTime() <= oneDayAgo);
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

interface UseMarketRatesOptions {
  resolution?: 'tick' | 'daily';
  days?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch market rate history
 *
 * @param marketAddress - The market contract address
 * @param options - Query options
 * @returns Processed rate data with history and stats
 */
export function useMarketRates(
  marketAddress: string | undefined,
  options: UseMarketRatesOptions = {}
): UseQueryResult<ProcessedRatesData> {
  const { resolution = 'daily', days = 30, enabled = true, refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['market-rates', marketAddress, resolution, days],
    queryFn: async () => {
      if (!marketAddress) throw new Error('Market address required');
      const data = await fetchRatesData(marketAddress, resolution, days);
      return processRatesData(data);
    },
    enabled: enabled && !!marketAddress,
    staleTime: 30000,
    refetchInterval,
    retry: 2,
    retryDelay: 5000,
  });
}
