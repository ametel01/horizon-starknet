'use client';

import { useMemo } from 'react';

import { useMarketRates } from '@features/markets';
import { usePriceImpact } from '@features/price';

/**
 * Smart Slippage Calculation
 *
 * Implements Error Prevention from UI/UX Implementation Plan §4:
 * Automatically suggests optimal slippage based on market conditions.
 *
 * Algorithm:
 * 1. Base slippage = historical avg price impact × safety multiplier (1.5x)
 * 2. Volatility adjustment = rate change volatility factor
 * 3. Bounds = floor (10 BPS) to prevent failures, cap (300 BPS) to limit risk
 *
 * @see UI-UX_IMPLEMENTATION_PLAN.md Phase 4 - Error Prevention
 */

// ============================================================================
// Constants
// ============================================================================

/** Minimum recommended slippage in BPS (0.1%) - prevents transaction failures */
const MIN_SMART_SLIPPAGE_BPS = 10;

/** Maximum recommended slippage in BPS (3%) - protects against excessive slippage */
const MAX_SMART_SLIPPAGE_BPS = 300;

/** Default fallback when no market data available */
const DEFAULT_SMART_SLIPPAGE_BPS = 50;

/** Safety multiplier applied to average impact (1.5x buffer) */
const IMPACT_SAFETY_MULTIPLIER = 1.5;

/** Volatility threshold where we start increasing slippage (10% rate change) */
const VOLATILITY_THRESHOLD_PERCENT = 10;

/** Maximum volatility adjustment in BPS (1%) */
const MAX_VOLATILITY_ADJUSTMENT_BPS = 100;

// ============================================================================
// Types
// ============================================================================

export interface SmartSlippageResult {
  /** Recommended slippage in basis points */
  recommendedBps: number;
  /** Confidence level of the recommendation */
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable explanation of the recommendation */
  reason: string;
  /** Whether the data is still loading */
  isLoading: boolean;
  /** Individual factors contributing to the calculation */
  factors: {
    /** Base slippage from price impact history */
    impactBaseBps: number;
    /** Additional slippage from rate volatility */
    volatilityAdjustmentBps: number;
    /** Whether data was available for calculation */
    hasMarketData: boolean;
  };
}

interface UseSmartSlippageOptions {
  /** Whether to enable the calculation */
  enabled?: boolean | undefined;
  /** Lookback period for price impact data in days */
  impactDays?: number | undefined;
  /** Lookback period for rate volatility in days */
  volatilityDays?: number | undefined;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to calculate smart slippage defaults based on market volatility
 *
 * @param marketAddress - The market contract address
 * @param options - Configuration options
 * @returns Smart slippage recommendation with confidence and explanation
 *
 * @example
 * ```tsx
 * const { recommendedBps, confidence, reason } = useSmartSlippage(marketAddress);
 * // recommendedBps: 75 (0.75%)
 * // confidence: 'high'
 * // reason: 'Based on 0.3% avg impact + low volatility'
 * ```
 */
export function useSmartSlippage(
  marketAddress: string | undefined,
  options: UseSmartSlippageOptions = {}
): SmartSlippageResult {
  const { enabled = true, impactDays = 30, volatilityDays = 7 } = options;

  // Fetch price impact data (30-day lookback for stable average)
  const { data: impactData, isLoading: isLoadingImpact } = usePriceImpact(marketAddress, {
    days: impactDays,
    enabled: enabled && !!marketAddress,
  });

  // Fetch rate volatility data (7-day lookback for recent volatility)
  const { data: ratesData, isLoading: isLoadingRates } = useMarketRates(marketAddress, {
    days: volatilityDays,
    enabled: enabled && !!marketAddress,
  });

  const result = useMemo((): SmartSlippageResult => {
    const isLoading = isLoadingImpact || isLoadingRates;

    // Default result when loading or no data
    if (!marketAddress || isLoading) {
      return {
        recommendedBps: DEFAULT_SMART_SLIPPAGE_BPS,
        confidence: 'low',
        reason: isLoading ? 'Calculating optimal slippage...' : 'Enter market address',
        isLoading,
        factors: {
          impactBaseBps: 0,
          volatilityAdjustmentBps: 0,
          hasMarketData: false,
        },
      };
    }

    // Check if we have enough data
    const hasImpactData = impactData !== undefined && impactData.totalSwaps > 0;
    const hasRatesData = ratesData !== undefined && ratesData.dataPoints.length > 0;

    if (!hasImpactData && !hasRatesData) {
      return {
        recommendedBps: DEFAULT_SMART_SLIPPAGE_BPS,
        confidence: 'low',
        reason: 'Limited market data - using default slippage',
        isLoading: false,
        factors: {
          impactBaseBps: DEFAULT_SMART_SLIPPAGE_BPS,
          volatilityAdjustmentBps: 0,
          hasMarketData: false,
        },
      };
    }

    // ========================================================================
    // Calculate Base Slippage from Price Impact
    // ========================================================================

    let impactBaseBps = 0;

    if (hasImpactData) {
      // Use average impact with safety multiplier
      // avgImpact is in percentage (e.g., 0.5 means 0.5%)
      const avgImpactPercent = impactData.avgImpact;
      impactBaseBps = Math.round(avgImpactPercent * 100 * IMPACT_SAFETY_MULTIPLIER);

      // Consider max impact for additional safety in volatile markets
      const maxImpactPercent = impactData.maxImpact;
      if (maxImpactPercent > avgImpactPercent * 3) {
        // Market has occasional large impacts - add buffer
        impactBaseBps = Math.round(impactBaseBps * 1.2);
      }
    } else {
      // No impact data - use minimum as base
      impactBaseBps = MIN_SMART_SLIPPAGE_BPS;
    }

    // ========================================================================
    // Calculate Volatility Adjustment
    // ========================================================================

    let volatilityAdjustmentBps = 0;

    if (hasRatesData) {
      // Use rate change percentage as volatility indicator
      const absRateChange = Math.abs(ratesData.rateChangePercent);

      // Rate range as percentage of average (another volatility measure)
      const rateRange = ratesData.maxRate - ratesData.minRate;
      const rateRangePercent = ratesData.avgRate > 0 ? (rateRange / ratesData.avgRate) * 100 : 0;

      // Take the higher of the two volatility measures
      const volatilityScore = Math.max(absRateChange, rateRangePercent / 2);

      if (volatilityScore > VOLATILITY_THRESHOLD_PERCENT) {
        // Scale volatility adjustment based on how much we exceed threshold
        const excessVolatility = volatilityScore - VOLATILITY_THRESHOLD_PERCENT;
        // Each 10% excess volatility adds ~25 BPS
        volatilityAdjustmentBps = Math.min(
          Math.round(excessVolatility * 2.5),
          MAX_VOLATILITY_ADJUSTMENT_BPS
        );
      }
    }

    // ========================================================================
    // Combine and Bound
    // ========================================================================

    const rawRecommendedBps = impactBaseBps + volatilityAdjustmentBps;
    const recommendedBps = Math.max(
      MIN_SMART_SLIPPAGE_BPS,
      Math.min(MAX_SMART_SLIPPAGE_BPS, rawRecommendedBps)
    );

    // ========================================================================
    // Determine Confidence Level
    // ========================================================================

    let confidence: 'high' | 'medium' | 'low';
    if (hasImpactData && impactData.totalSwaps >= 50 && hasRatesData) {
      confidence = 'high';
    } else if (hasImpactData && impactData.totalSwaps >= 10) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // ========================================================================
    // Generate Explanation
    // ========================================================================

    const reasons: string[] = [];

    if (hasImpactData) {
      reasons.push(`${impactData.avgImpact.toFixed(2)}% avg impact`);
    }

    if (volatilityAdjustmentBps > 0) {
      reasons.push('elevated volatility');
    } else if (hasRatesData) {
      reasons.push('stable rates');
    }

    const reason =
      reasons.length > 0 ? `Based on ${reasons.join(' + ')}` : 'Using default settings';

    return {
      recommendedBps,
      confidence,
      reason,
      isLoading: false,
      factors: {
        impactBaseBps,
        volatilityAdjustmentBps,
        hasMarketData: hasImpactData || hasRatesData,
      },
    };
  }, [marketAddress, impactData, ratesData, isLoadingImpact, isLoadingRates]);

  return result;
}

/**
 * Get a human-readable label for a slippage BPS value
 */
export function getSlippageLabel(bps: number): string {
  if (bps <= 15) return 'Very Low';
  if (bps <= 50) return 'Low';
  if (bps <= 100) return 'Standard';
  if (bps <= 200) return 'High';
  return 'Very High';
}

/**
 * Format slippage BPS as percentage string
 */
export function formatSlippagePercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}
