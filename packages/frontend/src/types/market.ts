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
}

export interface MarketData extends MarketInfo {
  state: MarketState;
  // Computed values
  impliedApy: BigNumber;
  tvlSy: bigint; // Total SY in pool (reserves + implicit from PT)
  daysToExpiry: number;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}
