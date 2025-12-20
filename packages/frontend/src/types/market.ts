import type BigNumber from 'bignumber.js';

export interface MarketInfo {
  address: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  expiry: number;
  isExpired: boolean;
}

export interface MarketState {
  syReserve: bigint;
  ptReserve: bigint;
  totalLpSupply: bigint;
  lnImpliedRate: bigint;
  /** Total protocol fees collected (in SY) @see Security Audit I-07 */
  feesCollected: bigint;
}

// Token metadata for display
export interface MarketTokenMetadata {
  key: string; // e.g. "nstSTRK", "sSTRK"
  underlyingAddress: string;
  yieldTokenName: string; // e.g. "Nostra Staked STRK"
  yieldTokenSymbol: string; // e.g. "nstSTRK"
  isERC4626: boolean;
  initialAnchor?: bigint; // AMM initial ln(implied rate) parameter
}

export interface MarketData extends MarketInfo {
  state: MarketState;
  // Computed values
  impliedApy: BigNumber;
  tvlSy: bigint; // Total SY in pool (reserves + implicit from PT)
  daysToExpiry: number;
  // Token metadata (optional, may not be available for unknown markets)
  metadata?: MarketTokenMetadata;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}
