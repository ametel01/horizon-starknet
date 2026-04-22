/**
 * P&L Tracking Utilities
 *
 * Tracks cost basis and calculates P&L using localStorage.
 */

import type { CostBasis } from '@entities/position';
import { fromWad, WAD_BIGINT, wadDiv, wadMul } from '@shared/math/wad';

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
export function loadCostBasis(): Map<string, CostBasis> {
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
 * Save cost basis entries to localStorage
 */
export function saveCostBasis(basis: Map<string, CostBasis>): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const entries: [string, CostBasisJson][] = Array.from(basis.entries()).map(([key, value]) => [
      key,
      {
        marketAddress: value.marketAddress,
        tokenType: value.tokenType,
        totalCost: value.totalCost.toString(),
        totalAmount: value.totalAmount.toString(),
        avgCost: value.avgCost.toString(),
        updatedAt: value.updatedAt,
      },
    ]);

    localStorage.setItem(COST_BASIS_KEY, JSON.stringify(entries));
  } catch {
    // Storage might be full or disabled
  }
}

/**
 * Update cost basis when acquiring tokens
 */
export function updateCostBasis(
  marketAddress: string,
  tokenType: 'sy' | 'pt' | 'yt' | 'lp',
  amountAcquired: bigint,
  costInSy: bigint
): void {
  const basis = loadCostBasis();
  const key = getCostBasisKey(marketAddress, tokenType);

  const existing = basis.get(key);

  if (existing) {
    // Update existing entry (average cost method)
    const newTotalCost = existing.totalCost + costInSy;
    const newTotalAmount = existing.totalAmount + amountAcquired;
    const newAvgCost = newTotalAmount > 0n ? wadDiv(newTotalCost, newTotalAmount) : 0n;

    basis.set(key, {
      ...existing,
      totalCost: newTotalCost,
      totalAmount: newTotalAmount,
      avgCost: newAvgCost,
      updatedAt: Date.now(),
    });
  } else {
    // Create new entry
    const avgCost = amountAcquired > 0n ? wadDiv(costInSy, amountAcquired) : 0n;

    basis.set(key, {
      marketAddress,
      tokenType,
      totalCost: costInSy,
      totalAmount: amountAcquired,
      avgCost,
      updatedAt: Date.now(),
    });
  }

  saveCostBasis(basis);
}

/**
 * Reduce cost basis when selling/redeeming tokens (FIFO-like)
 */
export function reduceCostBasis(
  marketAddress: string,
  tokenType: 'sy' | 'pt' | 'yt' | 'lp',
  amountSold: bigint
): bigint {
  const basis = loadCostBasis();
  const key = getCostBasisKey(marketAddress, tokenType);

  const existing = basis.get(key);

  if (!existing || existing.totalAmount === 0n) {
    return 0n; // No cost basis to reduce
  }

  // Calculate cost basis for sold amount using WAD precision
  const costBasisUsed =
    amountSold >= existing.totalAmount
      ? existing.totalCost
      : wadMul(existing.totalCost, wadDiv(amountSold, existing.totalAmount));

  // Reduce totals
  const newTotalAmount = existing.totalAmount > amountSold ? existing.totalAmount - amountSold : 0n;
  const newTotalCost = existing.totalCost > costBasisUsed ? existing.totalCost - costBasisUsed : 0n;

  if (newTotalAmount === 0n) {
    basis.delete(key);
  } else {
    basis.set(key, {
      ...existing,
      totalCost: newTotalCost,
      totalAmount: newTotalAmount,
      // Average cost stays the same for remaining position
      updatedAt: Date.now(),
    });
  }

  saveCostBasis(basis);

  return costBasisUsed;
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

/**
 * Clear all cost basis data (for testing or reset)
 */
export function clearCostBasis(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(COST_BASIS_KEY);
}

/**
 * Export cost basis data as JSON
 */
export function exportCostBasis(): string {
  const basis = loadCostBasis();
  const entries = Array.from(basis.entries()).map(([key, value]) => ({
    key,
    ...value,
    totalCost: value.totalCost.toString(),
    totalAmount: value.totalAmount.toString(),
    avgCost: value.avgCost.toString(),
  }));

  return JSON.stringify(entries, null, 2);
}
