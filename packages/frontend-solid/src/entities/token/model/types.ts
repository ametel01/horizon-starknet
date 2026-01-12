// Token model - types and data structures

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  balanceUsd?: number;
}
