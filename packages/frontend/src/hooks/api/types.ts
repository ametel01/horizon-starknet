/**
 * API response types for indexer endpoints
 */

// Health endpoint types
export type PoolMode = 'transaction' | 'session' | 'statement';

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    host: string | null;
    usePooler: boolean;
    poolMode: PoolMode | null;
    source: 'DATABASE_POOLER_URL' | 'DATABASE_URL' | null;
  };
  indexer: {
    lastIndexedBlock: number | null;
    currentChainBlock: number | null;
    lagBlocks: number | null;
    error: string | null;
  };
  timestamp: string;
}

// Markets endpoint types
export interface IndexedMarket {
  address: string;
  expiry: number;
  sy: string;
  pt: string;
  yt: string;
  underlying: string;
  underlyingSymbol: string;
  feeRate: string;
  initialExchangeRate: string;
  createdAt: string;
  syReserve: string;
  ptReserve: string;
  impliedRate: string;
  exchangeRate: string;
  isExpired: boolean;
  volume24h: string;
  swaps24h: number;
  lastActivity: string | null;
}

export interface MarketsResponse {
  markets: IndexedMarket[];
  total: number;
}

export interface MarketDetailResponse {
  market: {
    address: string;
    expiry: number;
    sy: string;
    pt: string;
    yt: string;
    underlying: string;
    underlyingSymbol: string;
    feeRate: string;
    initialExchangeRate: string;
    createdAt: string;
  };
  currentState: {
    syReserve: string;
    ptReserve: string;
    impliedRate: string;
    exchangeRate: string;
    isExpired: boolean;
    lastActivity: string | null;
  };
  stats24h: {
    volume: string;
    fees: string;
    swapCount: number;
  };
  stats7d: {
    volume: string;
    fees: string;
    swapCount: number;
    uniqueTraders: number;
  };
}

export interface SwapEvent {
  id: string;
  type: 'pt' | 'yt';
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  sender: string;
  receiver: string;
  // PT swap fields (always present)
  ptIn: string;
  syIn: string;
  ptOut: string;
  syOut: string;
  // YT swap fields (only for type: 'yt')
  ytIn?: string;
  ytOut?: string;
  // Optional fields (may not be available for router swaps)
  fee?: string;
  impliedRateBefore?: string;
  impliedRateAfter?: string;
  exchangeRate?: string;
}

export interface SwapsResponse {
  swaps: SwapEvent[];
  total: number;
  hasMore: boolean;
}

export interface TvlDataPoint {
  date: string;
  syReserve: string;
  ptReserve: string;
}

export interface TvlResponse {
  history: TvlDataPoint[];
}

export interface RateDataPoint {
  date: string;
  impliedRate: string;
  exchangeRate: string;
  lnImpliedRate: string;
}

export interface RatesResponse {
  history: RateDataPoint[];
}

// New rate data point format from /api/markets/[address]/rates
export interface MarketRateDataPoint {
  timestamp: string;
  impliedRate: string;
  exchangeRate: string;
  // OHLC fields for daily resolution
  open?: string;
  high?: string;
  low?: string;
  close?: string;
}

export interface MarketRatesResponse {
  market: string;
  resolution: 'tick' | 'daily';
  dataPoints: MarketRateDataPoint[];
}

// User endpoint types
export interface HistoryEvent {
  id: string;
  type: 'swap' | 'swap_yt' | 'add_liquidity' | 'remove_liquidity' | 'mint_py' | 'redeem_py';
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  market?: string;
  yt?: string;
  expiry?: number;
  underlyingSymbol?: string;
  amounts: Record<string, string>;
  exchangeRate?: string;
  impliedRate?: string;
}

export interface HistoryResponse {
  address: string;
  events: HistoryEvent[];
  total: number;
  hasMore: boolean;
}

export interface PyPosition {
  yt: string;
  pt: string;
  sy: string;
  expiry: number;
  netPtBalance: string;
  netYtBalance: string;
  avgEntryPyIndex: string | null;
  avgEntryExchangeRate: string | null;
  totalMinted: string;
  totalRedeemed: string;
  totalInterestClaimed: string;
  firstMint: string | null;
  lastActivity: string | null;
  isExpired: boolean;
}

export interface LpPosition {
  market: string;
  expiry: number;
  sy: string;
  pt: string;
  yt: string;
  underlying: string;
  underlyingSymbol: string;
  netLpBalance: string;
  totalSyDeposited: string;
  totalPtDeposited: string;
  totalSyWithdrawn: string;
  totalPtWithdrawn: string;
  avgEntryImpliedRate: string | null;
  avgEntryExchangeRate: string | null;
  firstMint: string | null;
  lastActivity: string | null;
  currentImpliedRate: string | null;
  currentExchangeRate: string | null;
  isExpired: boolean;
}

export interface PositionsResponse {
  address: string;
  pyPositions: PyPosition[];
  lpPositions: LpPosition[];
  summary: {
    totalPyPositions: number;
    totalLpPositions: number;
    activePyPositions: number;
    activeLpPositions: number;
  };
}

export interface YieldClaimEvent {
  id: string;
  yt: string;
  sy: string;
  expiry: number;
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  exchangeRate: string;
  blockTimestamp: string;
  transactionHash: string;
}

export interface YieldSummary {
  yt: string;
  sy: string;
  expiry: number;
  totalClaimed: string;
  claimCount: number;
  lastClaim: string | null;
  currentYtBalance: string;
}

export interface YieldResponse {
  address: string;
  totalYieldClaimed: string;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: YieldSummary[];
}

// Analytics endpoint types
export interface ProtocolTvlDataPoint {
  date: string;
  totalSyReserve: string;
  totalPtReserve: string;
  marketCount: number;
}

export interface ProtocolTvlResponse {
  current: {
    totalSyReserve: string;
    totalPtReserve: string;
    marketCount: number;
  };
  history: ProtocolTvlDataPoint[];
}

export interface VolumeDataPoint {
  date: string;
  syVolume: string;
  ptVolume: string;
  swapCount: number;
  uniqueSwappers: number;
}

export interface VolumeResponse {
  total24h: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
    uniqueSwappers: number;
  };
  total7d: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
  };
  history: VolumeDataPoint[];
}

export interface FeesDataPoint {
  date: string;
  totalFees: string;
  swapCount: number;
}

export interface MarketFeeBreakdown {
  market: string;
  underlyingSymbol: string;
  totalFees: string;
  swapCount: number;
  avgFeePerSwap: string;
}

export interface FeeCollection {
  market: string;
  collector: string;
  receiver: string;
  amount: string;
  timestamp: string;
  transactionHash: string;
}

export interface FeesResponse {
  total24h: string;
  total7d: string;
  total30d: string;
  history: FeesDataPoint[];
  byMarket: MarketFeeBreakdown[];
  recentCollections: FeeCollection[];
}

// Portfolio history types
export interface PortfolioValueEvent {
  type:
    | 'deposit'
    | 'withdraw'
    | 'mint_py'
    | 'redeem_py'
    | 'swap'
    | 'swap_yt'
    | 'add_liquidity'
    | 'remove_liquidity';
  timestamp: string;
  transactionHash: string;
  market?: string;
  underlyingSymbol?: string;
  syDelta: string;
  ptDelta: string;
  ytDelta: string;
  lpDelta: string;
  exchangeRate: string;
  valueChange: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalValueSy: string;
  syBalance: string;
  ptBalance: string;
  ytBalance: string;
  lpBalance: string;
  realizedPnl: string;
  unrealizedPnl: string;
  eventCount: number;
}

export interface PortfolioHistoryResponse {
  address: string;
  events: PortfolioValueEvent[];
  snapshots: PortfolioSnapshot[];
  summary: {
    totalDeposited: string;
    totalWithdrawn: string;
    realizedPnl: string;
    firstActivity: string | null;
    lastActivity: string | null;
    eventCount: number;
  };
}
