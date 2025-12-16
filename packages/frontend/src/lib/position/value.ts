/**
 * Position Value Calculator
 *
 * Calculates position values in SY and USD terms.
 */

import { WAD_BIGINT, fromWad, wadDiv, wadMul } from '../math/wad';

const SECONDS_PER_YEAR = 31_536_000;

/**
 * Calculate position value in multiple denominations
 */
export function calculatePositionValue(
  balance: bigint,
  priceInSy: bigint,
  syPriceUsd: number
): { amount: bigint; valueInSy: bigint; valueUsd: number } {
  if (balance === 0n) {
    return { amount: 0n, valueInSy: 0n, valueUsd: 0 };
  }

  const valueInSy = wadMul(balance, priceInSy);
  const valueUsd = fromWad(valueInSy).toNumber() * syPriceUsd;

  return {
    amount: balance,
    valueInSy,
    valueUsd,
  };
}

/**
 * Calculate PT price in SY terms
 * pt_price = e^(-ln_implied_rate * time_in_years)
 */
export function calculatePtPriceInSy(lnImpliedRate: bigint, timeToExpiry: bigint): bigint {
  if (timeToExpiry <= 0n || lnImpliedRate === 0n) {
    return WAD_BIGINT; // At expiry, PT = 1 SY
  }

  const timeInYears = Number(timeToExpiry) / SECONDS_PER_YEAR;
  const rate = fromWad(lnImpliedRate).toNumber();
  const price = Math.exp(-rate * timeInYears);

  // Convert back to WAD
  return BigInt(Math.floor(price * 1e18));
}

/**
 * Calculate YT price in SY terms
 * yt_price = 1 - pt_price
 */
export function calculateYtPriceInSy(lnImpliedRate: bigint, timeToExpiry: bigint): bigint {
  const ptPrice = calculatePtPriceInSy(lnImpliedRate, timeToExpiry);

  if (ptPrice >= WAD_BIGINT) {
    return 0n; // YT is worthless at/after expiry
  }

  return WAD_BIGINT - ptPrice;
}

/**
 * Calculate LP position value and composition
 */
export function calculateLpValue(
  lpBalance: bigint,
  totalLp: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  ptPriceInSy: bigint
): {
  valueInSy: bigint;
  underlyingSy: bigint;
  underlyingPt: bigint;
  sharePercent: number;
} {
  if (totalLp === 0n || lpBalance === 0n) {
    return {
      valueInSy: 0n,
      underlyingSy: 0n,
      underlyingPt: 0n,
      sharePercent: 0,
    };
  }

  // LP share of reserves (using WAD precision for proportional calculations)
  const lpShare = wadDiv(lpBalance, totalLp);
  const underlyingSy = wadMul(lpShare, syReserve);
  const underlyingPt = wadMul(lpShare, ptReserve);

  // Value in SY terms (SY + PT * ptPrice)
  const ptValueInSy = wadMul(underlyingPt, ptPriceInSy);
  const valueInSy = underlyingSy + ptValueInSy;

  // Share percentage (using WAD precision)
  const sharePercent = fromWad(lpShare).toNumber() * 100;

  return {
    valueInSy,
    underlyingSy,
    underlyingPt,
    sharePercent,
  };
}

/**
 * Calculate time to expiry in seconds
 */
export function getTimeToExpiry(expiry: number): bigint {
  const now = Math.floor(Date.now() / 1000);

  if (now >= expiry) {
    return 0n;
  }

  return BigInt(expiry - now);
}

/**
 * Calculate total position value for a market
 */
export function calculateTotalPositionValue(
  syBalance: bigint,
  ptBalance: bigint,
  ytBalance: bigint,
  lpBalance: bigint,
  totalLp: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  lnImpliedRate: bigint,
  expiry: number,
  syPriceUsd: number
): {
  syValue: { amount: bigint; valueInSy: bigint; valueUsd: number };
  ptValue: { amount: bigint; valueInSy: bigint; valueUsd: number };
  ytValue: { amount: bigint; valueInSy: bigint; valueUsd: number };
  lpValue: { amount: bigint; valueInSy: bigint; valueUsd: number };
  lpDetails: {
    underlyingSy: bigint;
    underlyingPt: bigint;
    sharePercent: number;
  };
  totalValueUsd: number;
} {
  const timeToExpiry = getTimeToExpiry(expiry);
  const ptPriceInSy = calculatePtPriceInSy(lnImpliedRate, timeToExpiry);
  const ytPriceInSy = calculateYtPriceInSy(lnImpliedRate, timeToExpiry);

  // Calculate individual position values
  const syValue = calculatePositionValue(syBalance, WAD_BIGINT, syPriceUsd);
  const ptValue = calculatePositionValue(ptBalance, ptPriceInSy, syPriceUsd);
  const ytValue = calculatePositionValue(ytBalance, ytPriceInSy, syPriceUsd);

  // Calculate LP value
  const lpCalc = calculateLpValue(lpBalance, totalLp, syReserve, ptReserve, ptPriceInSy);
  const lpValue = {
    amount: lpBalance,
    valueInSy: lpCalc.valueInSy,
    valueUsd: fromWad(lpCalc.valueInSy).toNumber() * syPriceUsd,
  };

  // Total value
  const totalValueUsd = syValue.valueUsd + ptValue.valueUsd + ytValue.valueUsd + lpValue.valueUsd;

  return {
    syValue,
    ptValue,
    ytValue,
    lpValue,
    lpDetails: {
      underlyingSy: lpCalc.underlyingSy,
      underlyingPt: lpCalc.underlyingPt,
      sharePercent: lpCalc.sharePercent,
    },
    totalValueUsd,
  };
}

/**
 * Format USD value for display
 */
export function formatUsd(value: number): string {
  if (value === 0) {
    return '$0.00';
  }

  if (Math.abs(value) < 0.01) {
    return value > 0 ? '< $0.01' : '> -$0.01';
  }

  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }

  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }

  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  if (Math.abs(value) < 0.01 && value !== 0) {
    return value > 0 ? '< 0.01%' : '> -0.01%';
  }

  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
