import type { LpPosition } from '@shared/api/types';

const WAD = BigInt(10) ** BigInt(18);

/**
 * IL direction styling using decision table pattern.
 */
export type IlDirection = 'loss' | 'gain' | 'neutral';

const IL_DIRECTION_STYLES: Record<IlDirection, { bg: string; text: string; bar: string }> = {
  loss: { bg: 'bg-destructive/10', text: 'text-destructive', bar: 'bg-destructive' },
  gain: { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' },
  neutral: { bg: 'bg-muted/50', text: 'text-foreground', bar: 'bg-muted-foreground/50' },
};

export function getIlDirectionStyles(direction: IlDirection): {
  bg: string;
  text: string;
  bar: string;
} {
  return IL_DIRECTION_STYLES[direction];
}

/**
 * Calculate impermanent loss for an LP position
 *
 * IL occurs when the price ratio of assets in the pool changes from entry.
 * For PT/SY pools, PT converges to 1 SY at maturity.
 *
 * IL = (HODL Value - LP Value) / HODL Value
 *
 * Where:
 * - HODL Value = initial SY + (initial PT * current PT price)
 * - LP Value = current value of LP tokens in terms of SY
 */
export interface IlMetrics {
  // Entry values
  entrySy: bigint;
  entryPt: bigint;
  entryPtPriceInSy: bigint; // PT price in SY at entry

  // Current values
  currentSy: bigint;
  currentPt: bigint;
  currentPtPriceInSy: bigint; // PT price in SY now

  // HODL vs LP comparison
  hodlValueSy: bigint; // Value if just held SY + PT separately
  lpValueSy: bigint; // Current value of LP position in SY

  // IL calculation
  ilAbsolute: bigint; // HODL - LP (positive = loss)
  ilPercent: number; // IL as percentage
  ilDirection: 'loss' | 'gain' | 'neutral';
}

export function calculateIl(
  position: LpPosition,
  poolReserves: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLpSupply: bigint;
  }
): IlMetrics | null {
  const totalSyDeposited = BigInt(position.totalSyDeposited);
  const totalPtDeposited = BigInt(position.totalPtDeposited);
  const totalSyWithdrawn = BigInt(position.totalSyWithdrawn);
  const totalPtWithdrawn = BigInt(position.totalPtWithdrawn);
  const currentLpBalance = BigInt(position.netLpBalance);

  // Net deposits (what's still in the pool from this user)
  const netSyDeposited = totalSyDeposited - totalSyWithdrawn;
  const netPtDeposited = totalPtDeposited - totalPtWithdrawn;

  // If no net deposits, no IL to calculate
  if (netSyDeposited <= 0n && netPtDeposited <= 0n) {
    return null;
  }

  // Calculate entry PT price from entry exchange rate
  // If we don't have it, estimate from deposit ratio
  let entryPtPriceInSy: bigint;
  if (position.avgEntryExchangeRate) {
    // Exchange rate is typically SY/PT, so PT price = 1/exchangeRate
    const entryExchangeRate = BigInt(position.avgEntryExchangeRate);
    entryPtPriceInSy = entryExchangeRate > 0n ? (WAD * WAD) / entryExchangeRate : WAD;
  } else if (netPtDeposited > 0n) {
    // Estimate from deposit ratio: assume deposits were at market price
    entryPtPriceInSy = (netSyDeposited * WAD) / netPtDeposited;
  } else {
    entryPtPriceInSy = WAD; // Default to 1:1
  }

  // Calculate current PT price from pool reserves
  // PT price in SY = syReserve / ptReserve (simplified)
  const currentPtPriceInSy =
    poolReserves.ptReserve > 0n ? (poolReserves.syReserve * WAD) / poolReserves.ptReserve : WAD;

  // Calculate LP share of pool
  const lpShare =
    poolReserves.totalLpSupply > 0n ? (currentLpBalance * WAD) / poolReserves.totalLpSupply : 0n;

  // Current LP value in SY
  const currentSyFromLp = (poolReserves.syReserve * lpShare) / WAD;
  const currentPtFromLp = (poolReserves.ptReserve * lpShare) / WAD;
  const lpValueSy = currentSyFromLp + (currentPtFromLp * currentPtPriceInSy) / WAD;

  // HODL value: if user had just held the initial SY + PT
  // HODL = initial SY + (initial PT * current PT price)
  const hodlValueSy = netSyDeposited + (netPtDeposited * currentPtPriceInSy) / WAD;

  // IL calculation
  const ilAbsolute = hodlValueSy - lpValueSy;
  const ilPercent = hodlValueSy > 0n ? (Number(ilAbsolute) / Number(hodlValueSy)) * 100 : 0;

  let ilDirection: 'loss' | 'gain' | 'neutral';
  if (ilAbsolute > WAD / 1000n) {
    ilDirection = 'loss';
  } else if (ilAbsolute < -WAD / 1000n) {
    ilDirection = 'gain';
  } else {
    ilDirection = 'neutral';
  }

  return {
    entrySy: netSyDeposited,
    entryPt: netPtDeposited,
    entryPtPriceInSy,
    currentSy: currentSyFromLp,
    currentPt: currentPtFromLp,
    currentPtPriceInSy,
    hodlValueSy,
    lpValueSy,
    ilAbsolute,
    ilPercent,
    ilDirection,
  };
}
