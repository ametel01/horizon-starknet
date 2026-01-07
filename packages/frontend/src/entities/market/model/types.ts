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
  /** Natural log of fee rate root in WAD (10^18). Use calculateAnnualFeeRate() to convert. */
  lnFeeRateRoot: bigint;
  /** Percentage (0-100) of fees going to protocol treasury. Remainder goes to LPs. */
  reserveFeePercent: number;
}

// Token metadata for display
export interface MarketTokenMetadata {
  key: string; // e.g. "sSTRK", "sSTRK"
  underlyingAddress: string;
  yieldTokenName: string; // e.g. "Staked Starknet Token"
  yieldTokenSymbol: string; // e.g. "sSTRK"
  isERC4626: boolean;
  initialAnchor?: bigint; // AMM initial ln(implied rate) parameter
}

export interface MarketData extends MarketInfo {
  state: MarketState;
  // Computed values
  impliedApy: BigNumber;
  tvlSy: bigint; // Total SY in pool (reserves + implicit from PT)
  daysToExpiry: number;
  /** Annual fee rate as a decimal (e.g., 0.01 = 1%). Computed from lnFeeRateRoot. */
  annualFeeRate: number;
  // Token metadata (optional, may not be available for unknown markets)
  metadata?: MarketTokenMetadata;
  // TWAP oracle fields
  /** TWAP-based implied APY (primary display), falls back to spot if unavailable */
  twapImpliedApy: BigNumber;
  /** Spot implied APY (secondary display, always available) */
  spotImpliedApy: BigNumber;
  /** Oracle status for this market */
  oracleState: 'ready' | 'partial' | 'spot-only';
  /** TWAP duration used (seconds), 0 if spot-only */
  twapDuration: number;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}
