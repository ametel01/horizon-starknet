/**
 * Enhanced Position Types
 *
 * Types for comprehensive position tracking with USD values and P&L.
 */

import type { MarketData } from '@entities/market';

/**
 * Position value with multiple denominations
 */
export interface PositionValue {
  /** Raw token amount in WAD */
  amount: bigint;
  /** Value in SY terms */
  valueInSy: bigint;
  /** Value in USD */
  valueUsd: number;
}

/**
 * Yield tracking data
 */
export interface YieldData {
  /** Currently claimable yield */
  claimable: bigint;
  /** Claimable value in USD */
  claimableUsd: number;
  /** Total historically claimed */
  claimed: bigint;
  /** Historical claimed in USD */
  claimedUsd: number;
}

/**
 * LP position details
 */
export interface LpDetails {
  /** User's share of pool as percentage */
  sharePercent: number;
  /** User's share of SY reserves */
  underlyingSy: bigint;
  /** User's share of PT reserves */
  underlyingPt: bigint;
  /** Accrued fees (future) */
  fees: bigint;
}

/**
 * P&L tracking data
 */
export interface PnlData {
  /** Unrealized P&L in SY terms */
  unrealizedSy: bigint;
  /** Unrealized P&L in USD */
  unrealizedUsd: number;
  /** Realized P&L from closed positions */
  realizedSy: bigint;
  /** Realized P&L in USD */
  realizedUsd: number;
  /** Total P&L percentage */
  totalPnlPercent: number;
}

/**
 * Redemption status
 */
export interface RedemptionStatus {
  /** Can redeem PT+YT before expiry */
  canRedeemPtYt: boolean;
  /** Can redeem PT after expiry */
  canRedeemPtPostExpiry: boolean;
  /** PT redemption value at maturity */
  ptRedemptionValue: bigint;
}

/**
 * Enhanced position data for a single market
 */
export interface EnhancedPosition {
  /** Market data */
  market: MarketData;

  /** Token positions with values */
  sy: PositionValue;
  pt: PositionValue;
  yt: PositionValue;
  lp: PositionValue;

  /** Yield tracking */
  yield: YieldData;

  /** LP position details */
  lpDetails: LpDetails;

  /** P&L tracking */
  pnl: PnlData;

  /** Redemption options */
  redemption: RedemptionStatus;

  /** Total position value in USD */
  totalValueUsd: number;
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** Total unrealized P&L in USD */
  totalPnlUsd: number;
  /** Total P&L percentage */
  totalPnlPercent: number;
  /** Total claimable yield in USD */
  totalClaimableUsd: number;
  /** All positions */
  positions: EnhancedPosition[];
}

/**
 * Token price data
 */
export interface TokenPrices {
  strk: number;
  eth: number;
  nstStrk: number;
  sStrk: number;
  wstEth: number;
}

/**
 * Cost basis for P&L tracking
 */
export interface CostBasis {
  marketAddress: string;
  tokenType: 'sy' | 'pt' | 'yt' | 'lp';
  /** Total SY spent to acquire */
  totalCost: bigint;
  /** Total tokens acquired */
  totalAmount: bigint;
  /** Average cost per token in WAD */
  avgCost: bigint;
  /** Timestamp of last update */
  updatedAt: number;
}
