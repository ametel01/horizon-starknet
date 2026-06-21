/**
 * P&L Tracking Utilities
 *
 * Tracks cost basis and calculates P&L using localStorage.
 */

import type { CostBasis } from '@entities/position';
import { fromWad, WAD_BIGINT, wadMul } from '@shared/math/wad';

// Version localStorage keys to prevent data corruption on schema changes
// Increment version when changing the stored data structure
const STORAGE_VERSION = 'v1';
const COST_BASIS_KEY = `horizon_cost_basis_${STORAGE_VERSION}`;

/**
 * Generate a unique key for a cost basis entry
 */
function getCostBasisKey(marketAddress: string, tokenType: string): string {
  return `${marketAddress.toLowerCase()}-${tokenType}`;
}

/**
 * Load all cost basis entries from localStorage
 */
function loadCostBasis(): Map<string, CostBasis> {
  if (typeof window === 'undefined') {
    return new Map();
  }

  try {
    const data = localStorage.getItem(COST_BASIS_KEY);
    if (!data) {
      return new Map();
    }

    const parsed = JSON.parse(data) as [string, CostBasisJson][];
    const entries: [string, CostBasis][] = parsed.map(([key, value]) => [
      key,
      {
        marketAddress: value.marketAddress,
        tokenType: value.tokenType as 'sy' | 'pt' | 'yt' | 'lp',
        totalCost: BigInt(value.totalCost),
        totalAmount: BigInt(value.totalAmount),
        avgCost: BigInt(value.avgCost),
        updatedAt: value.updatedAt,
      },
    ]);

    return new Map(entries);
  } catch {
    return new Map();
  }
}

interface CostBasisJson {
  marketAddress: string;
  tokenType: string;
  totalCost: string;
  totalAmount: string;
  avgCost: string;
  updatedAt: number;
}

/**
 * Get cost basis for a specific position
 */
export function getCostBasis(
  marketAddress: string,
  tokenType: 'sy' | 'pt' | 'yt' | 'lp'
): CostBasis | null {
  const basis = loadCostBasis();
  const key = getCostBasisKey(marketAddress, tokenType);
  return basis.get(key) ?? null;
}

/**
 * Calculate unrealized P&L for a position
 */
export function calculateUnrealizedPnl(
  currentAmount: bigint,
  currentPriceInSy: bigint,
  costBasis: CostBasis | null
): { pnlSy: bigint; pnlPercent: number } {
  if (currentAmount === 0n || !costBasis || costBasis.avgCost === 0n) {
    return { pnlSy: 0n, pnlPercent: 0 };
  }

  // Current value in SY (using WAD precision)
  const currentValue = wadMul(currentAmount, currentPriceInSy);

  // Cost basis for current amount (using WAD precision)
  const costValue = wadMul(currentAmount, costBasis.avgCost);

  // P&L
  const pnlSy = currentValue - costValue;

  // P&L percentage
  const pnlPercent =
    costValue > 0n ? fromWad((pnlSy * WAD_BIGINT) / costValue).toNumber() * 100 : 0;

  return { pnlSy, pnlPercent };
}
