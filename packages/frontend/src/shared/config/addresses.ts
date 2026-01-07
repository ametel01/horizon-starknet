import devnetAddressesRaw from '@deploy/addresses/devnet.json';
import forkAddressesRaw from '@deploy/addresses/fork.json';
import mainnetAddressesRaw from '@deploy/addresses/mainnet.json';
import sepoliaAddressesRaw from '@deploy/addresses/sepolia.json';

import type { NetworkId } from '../starknet/provider';

// Type definition for sepolia addresses JSON structure
interface SepoliaYieldTokenInfo {
  name: string;
  symbol: string;
  address: string;
  isERC4626: boolean;
}

interface SepoliaSYTokenInfo {
  address: string;
  underlying: string;
  isERC4626: boolean;
}

interface SepoliaMarketAddresses {
  PT: string;
  YT: string;
  Market: string;
  initialAnchor: string;
}

interface SepoliaAddresses {
  network: string;
  rpcUrl: string;
  deployedAt: string;
  classHashes: Record<string, string>;
  contracts: {
    Factory: string;
    MarketFactory: string;
    Router: string;
    PyLpOracle?: string;
  };
  testSetup: {
    testRecipient: string;
    baseToken: {
      STRK: string;
      ETH: string;
    };
    yieldTokens: {
      nstSTRK: SepoliaYieldTokenInfo;
      sSTRK: SepoliaYieldTokenInfo;
      wstETH: SepoliaYieldTokenInfo;
    };
    syTokens: {
      'SY-nstSTRK': SepoliaSYTokenInfo;
      'SY-sSTRK': SepoliaSYTokenInfo;
      'SY-wstETH': SepoliaSYTokenInfo;
    };
    markets: {
      nstSTRK: SepoliaMarketAddresses;
      sSTRK: SepoliaMarketAddresses;
      wstETH: SepoliaMarketAddresses;
    };
    marketParams: {
      scalarRoot: string;
      feeRate: string;
    };
    liquidity: {
      seeded: boolean;
      seedAmount: string;
    };
    expiry: number;
  };
}

/**
 * Normalize a Starknet address for comparison
 * Converts to lowercase and removes leading zeros after 0x
 */
function normalizeAddress(address: string): string {
  // Remove 0x prefix, strip leading zeros, add back 0x, lowercase
  const hex = address.toLowerCase().replace(/^0x0*/, '');
  return `0x${hex}`;
}

// Type definitions for the dual-market JSON structure
interface YieldTokenInfo {
  name: string;
  symbol: string;
  address: string;
  isERC4626: boolean;
}

interface SYTokenInfo {
  address: string;
  underlying: string;
}

interface MarketAddresses {
  PT: string;
  YT: string;
  Market: string;
}

interface DevnetAddresses {
  network: string;
  rpcUrl: string;
  deployedAt: string;
  classHashes: Record<string, string>;
  contracts: {
    Factory?: string;
    MarketFactory?: string;
    Router?: string;
    PyLpOracle?: string;
  };
  testSetup: {
    testRecipient?: string;
    baseToken?: {
      STRK?: string;
    };
    yieldTokens?: {
      nstSTRK?: YieldTokenInfo;
      sSTRK?: YieldTokenInfo;
    };
    syTokens?: {
      'SY-nstSTRK'?: SYTokenInfo;
      'SY-sSTRK'?: SYTokenInfo;
    };
    markets?: {
      nstSTRK?: MarketAddresses;
      sSTRK?: MarketAddresses;
    };
    expiry?: number;
  };
  marketParams?: {
    scalarRoot?: string;
    initialAnchor?: string;
    feeRate?: string;
  };
}

const devnetAddresses = devnetAddressesRaw as DevnetAddresses;

// Type definition for fork addresses JSON structure
interface ForkMarketAddresses {
  SY: string;
  PT: string;
  YT: string;
  Market: string;
}

interface ForkAddresses {
  network: string;
  rpcUrl: string;
  mainnetRpcUrl: string;
  deployedAt: string;
  pragmaTwap: string;
  classHashes: Record<string, string>;
  contracts: {
    Factory: string;
    MarketFactory: string;
    Router: string;
    PyLpOracle?: string;
  };
  mainnetTokens: {
    sSTRK: string;
    wstETH: string;
    nstSTRK: string;
  };
  oracles: Record<string, string>;
  markets: {
    sSTRK: ForkMarketAddresses;
    wstETH: ForkMarketAddresses;
    nstSTRK: ForkMarketAddresses;
  };
  expiry: number;
}

const forkAddresses = forkAddressesRaw as ForkAddresses;
const sepoliaAddresses = sepoliaAddressesRaw as SepoliaAddresses;

// Type definition for mainnet addresses JSON structure
interface MainnetYieldTokenInfo {
  name: string;
  symbol: string;
  address: string;
  isERC4626: boolean;
  faucet: string;
  faucetDailyLimit: string;
}

interface MainnetSYTokenInfo {
  address: string;
  underlying: string;
  isERC4626: boolean;
}

interface MainnetMarketAddresses {
  PT: string;
  YT: string;
  Market: string;
  initialAnchor: string;
}

interface MainnetAddresses {
  network: string;
  rpcUrl: string;
  deployedAt: string;
  classHashes: Record<string, string>;
  contracts: {
    Factory: string;
    MarketFactory: string;
    Router: string;
    Faucet: string;
    PyLpOracle?: string;
  };
  tokens: {
    STRK: string;
    hrzSTRK: MainnetYieldTokenInfo;
  };
  syTokens: {
    'SY-hrzSTRK': MainnetSYTokenInfo;
  };
  markets: {
    hrzSTRK: MainnetMarketAddresses;
  };
  marketParams: {
    scalarRoot: string;
    feeRate: string;
  };
  liquidity: {
    seeded: boolean;
    seedAmount: string;
  };
  testRecipient: string;
  expiry: number;
}

const mainnetAddresses = mainnetAddressesRaw as MainnetAddresses;

export interface ContractAddresses {
  factory: string;
  marketFactory: string;
  router: string;
  pyLpOracle: string;
}

// New market info structure for dual-market support
export interface MarketInfo {
  key: string;
  marketAddress: string;
  ptAddress: string;
  ytAddress: string;
  syAddress: string;
  underlyingAddress: string;
  yieldTokenName: string;
  yieldTokenSymbol: string;
  isERC4626: boolean;
  expiry: number;
  initialAnchor?: bigint; // AMM initial ln(implied rate) parameter
}

// Placeholder for undeployed contracts
const ZERO_ADDRESS = '0x0';

// Core protocol addresses per network
const ADDRESSES: Record<NetworkId, ContractAddresses> = {
  devnet: {
    factory: devnetAddresses.contracts.Factory ?? ZERO_ADDRESS,
    marketFactory: devnetAddresses.contracts.MarketFactory ?? ZERO_ADDRESS,
    router: devnetAddresses.contracts.Router ?? ZERO_ADDRESS,
    pyLpOracle: devnetAddresses.contracts.PyLpOracle ?? ZERO_ADDRESS,
  },
  fork: {
    factory: forkAddresses.contracts.Factory,
    marketFactory: forkAddresses.contracts.MarketFactory,
    router: forkAddresses.contracts.Router,
    pyLpOracle: forkAddresses.contracts.PyLpOracle ?? ZERO_ADDRESS,
  },
  sepolia: {
    factory: sepoliaAddresses.contracts.Factory,
    marketFactory: sepoliaAddresses.contracts.MarketFactory,
    router: sepoliaAddresses.contracts.Router,
    pyLpOracle: sepoliaAddresses.contracts.PyLpOracle ?? ZERO_ADDRESS,
  },
  mainnet: {
    factory: mainnetAddresses.contracts.Factory,
    marketFactory: mainnetAddresses.contracts.MarketFactory,
    router: mainnetAddresses.contracts.Router,
    pyLpOracle: mainnetAddresses.contracts.PyLpOracle ?? ZERO_ADDRESS,
  },
};

export function getAddresses(network: NetworkId): ContractAddresses {
  return ADDRESSES[network];
}

/**
 * Get base token address (STRK)
 */
export function getBaseTokenAddress(network: NetworkId): string {
  if (network === 'devnet') {
    return devnetAddresses.testSetup.baseToken?.STRK ?? ZERO_ADDRESS;
  }
  // Fork mode doesn't have a base STRK token (uses mainnet tokens)
  return ZERO_ADDRESS;
}

/**
 * Get test recipient address
 */
export function getTestRecipient(network: NetworkId): string {
  if (network === 'devnet') {
    return devnetAddresses.testSetup.testRecipient ?? ZERO_ADDRESS;
  }
  return ZERO_ADDRESS;
}

/**
 * Get all market infos with token metadata for a network
 */
export function getMarketInfos(network: NetworkId): MarketInfo[] {
  // Handle fork mode
  if (network === 'fork') {
    return getForkMarketInfos();
  }

  // Handle devnet mode
  if (network === 'devnet') {
    return getDevnetMarketInfos();
  }

  // Handle sepolia mode
  if (network === 'sepolia') {
    return getSepoliaMarketInfos();
  }

  // Default to mainnet
  return getMainnetMarketInfos();
}

/**
 * Get market infos for devnet (mock tokens)
 */
function getDevnetMarketInfos(): MarketInfo[] {
  const markets: MarketInfo[] = [];
  const { testSetup } = devnetAddresses;

  // nstSTRK market
  if (testSetup.markets?.nstSTRK?.Market && testSetup.yieldTokens?.nstSTRK) {
    markets.push({
      key: 'nstSTRK',
      marketAddress: testSetup.markets.nstSTRK.Market,
      ptAddress: testSetup.markets.nstSTRK.PT,
      ytAddress: testSetup.markets.nstSTRK.YT,
      syAddress: testSetup.syTokens?.['SY-nstSTRK']?.address ?? '',
      underlyingAddress: testSetup.yieldTokens.nstSTRK.address,
      yieldTokenName: testSetup.yieldTokens.nstSTRK.name,
      yieldTokenSymbol: testSetup.yieldTokens.nstSTRK.symbol,
      isERC4626: testSetup.yieldTokens.nstSTRK.isERC4626,
      expiry: testSetup.expiry ?? 0,
    });
  }

  // sSTRK market
  if (testSetup.markets?.sSTRK?.Market && testSetup.yieldTokens?.sSTRK) {
    markets.push({
      key: 'sSTRK',
      marketAddress: testSetup.markets.sSTRK.Market,
      ptAddress: testSetup.markets.sSTRK.PT,
      ytAddress: testSetup.markets.sSTRK.YT,
      syAddress: testSetup.syTokens?.['SY-sSTRK']?.address ?? '',
      underlyingAddress: testSetup.yieldTokens.sSTRK.address,
      yieldTokenName: testSetup.yieldTokens.sSTRK.name,
      yieldTokenSymbol: testSetup.yieldTokens.sSTRK.symbol,
      isERC4626: testSetup.yieldTokens.sSTRK.isERC4626,
      expiry: testSetup.expiry ?? 0,
    });
  }

  return markets;
}

/**
 * Get market infos for fork mode (mainnet tokens)
 */
function getForkMarketInfos(): MarketInfo[] {
  const markets: MarketInfo[] = [];

  // sSTRK market
  if (forkAddresses.markets.sSTRK.Market) {
    markets.push({
      key: 'sSTRK',
      marketAddress: forkAddresses.markets.sSTRK.Market,
      ptAddress: forkAddresses.markets.sSTRK.PT,
      ytAddress: forkAddresses.markets.sSTRK.YT,
      syAddress: forkAddresses.markets.sSTRK.SY,
      underlyingAddress: forkAddresses.mainnetTokens.sSTRK,
      yieldTokenName: 'Staked STRK',
      yieldTokenSymbol: 'sSTRK',
      isERC4626: false, // mainnet sSTRK uses oracle
      expiry: forkAddresses.expiry,
    });
  }

  // wstETH market
  if (forkAddresses.markets.wstETH.Market) {
    markets.push({
      key: 'wstETH',
      marketAddress: forkAddresses.markets.wstETH.Market,
      ptAddress: forkAddresses.markets.wstETH.PT,
      ytAddress: forkAddresses.markets.wstETH.YT,
      syAddress: forkAddresses.markets.wstETH.SY,
      underlyingAddress: forkAddresses.mainnetTokens.wstETH,
      yieldTokenName: 'Wrapped stETH',
      yieldTokenSymbol: 'wstETH',
      isERC4626: false, // mainnet wstETH uses oracle
      expiry: forkAddresses.expiry,
    });
  }

  // nstSTRK market
  if (forkAddresses.markets.nstSTRK.Market) {
    markets.push({
      key: 'nstSTRK',
      marketAddress: forkAddresses.markets.nstSTRK.Market,
      ptAddress: forkAddresses.markets.nstSTRK.PT,
      ytAddress: forkAddresses.markets.nstSTRK.YT,
      syAddress: forkAddresses.markets.nstSTRK.SY,
      underlyingAddress: forkAddresses.mainnetTokens.nstSTRK,
      yieldTokenName: 'Nostra Staked STRK',
      yieldTokenSymbol: 'nstSTRK',
      isERC4626: false, // mainnet nstSTRK uses oracle
      expiry: forkAddresses.expiry,
    });
  }

  return markets;
}

/**
 * Get market infos for sepolia (ERC-4626 mock tokens)
 */
function getSepoliaMarketInfos(): MarketInfo[] {
  const { testSetup } = sepoliaAddresses;

  return [
    // nstSTRK market
    {
      key: 'nstSTRK',
      marketAddress: testSetup.markets.nstSTRK.Market,
      ptAddress: testSetup.markets.nstSTRK.PT,
      ytAddress: testSetup.markets.nstSTRK.YT,
      syAddress: testSetup.syTokens['SY-nstSTRK'].address,
      underlyingAddress: testSetup.yieldTokens.nstSTRK.address,
      yieldTokenName: testSetup.yieldTokens.nstSTRK.name,
      yieldTokenSymbol: testSetup.yieldTokens.nstSTRK.symbol,
      isERC4626: testSetup.yieldTokens.nstSTRK.isERC4626,
      expiry: testSetup.expiry,
      initialAnchor: BigInt(testSetup.markets.nstSTRK.initialAnchor || '0'),
    },
    // sSTRK market
    {
      key: 'sSTRK',
      marketAddress: testSetup.markets.sSTRK.Market,
      ptAddress: testSetup.markets.sSTRK.PT,
      ytAddress: testSetup.markets.sSTRK.YT,
      syAddress: testSetup.syTokens['SY-sSTRK'].address,
      underlyingAddress: testSetup.yieldTokens.sSTRK.address,
      yieldTokenName: testSetup.yieldTokens.sSTRK.name,
      yieldTokenSymbol: testSetup.yieldTokens.sSTRK.symbol,
      isERC4626: testSetup.yieldTokens.sSTRK.isERC4626,
      expiry: testSetup.expiry,
      initialAnchor: BigInt(testSetup.markets.sSTRK.initialAnchor || '0'),
    },
    // wstETH market
    {
      key: 'wstETH',
      marketAddress: testSetup.markets.wstETH.Market,
      ptAddress: testSetup.markets.wstETH.PT,
      ytAddress: testSetup.markets.wstETH.YT,
      syAddress: testSetup.syTokens['SY-wstETH'].address,
      underlyingAddress: testSetup.yieldTokens.wstETH.address,
      yieldTokenName: testSetup.yieldTokens.wstETH.name,
      yieldTokenSymbol: testSetup.yieldTokens.wstETH.symbol,
      isERC4626: testSetup.yieldTokens.wstETH.isERC4626,
      expiry: testSetup.expiry,
      initialAnchor: BigInt(testSetup.markets.wstETH.initialAnchor || '0'),
    },
  ];
}

/**
 * Get market infos for mainnet (hrzSTRK mock token for testing)
 */
function getMainnetMarketInfos(): MarketInfo[] {
  return [
    // hrzSTRK market (Horizon Mock Staked STRK)
    {
      key: 'hrzSTRK',
      marketAddress: mainnetAddresses.markets.hrzSTRK.Market,
      ptAddress: mainnetAddresses.markets.hrzSTRK.PT,
      ytAddress: mainnetAddresses.markets.hrzSTRK.YT,
      syAddress: mainnetAddresses.syTokens['SY-hrzSTRK'].address,
      underlyingAddress: mainnetAddresses.tokens.hrzSTRK.address,
      yieldTokenName: mainnetAddresses.tokens.hrzSTRK.name,
      yieldTokenSymbol: mainnetAddresses.tokens.hrzSTRK.symbol,
      isERC4626: mainnetAddresses.tokens.hrzSTRK.isERC4626,
      expiry: mainnetAddresses.expiry,
      initialAnchor: BigInt(mainnetAddresses.markets.hrzSTRK.initialAnchor || '0'),
    },
  ];
}

/**
 * Get market info by market address
 */
export function getMarketInfoByAddress(
  network: NetworkId,
  marketAddress: string
): MarketInfo | undefined {
  const markets = getMarketInfos(network);
  const normalizedTarget = normalizeAddress(marketAddress);
  return markets.find((m) => normalizeAddress(m.marketAddress) === normalizedTarget);
}

/**
 * Get market parameters (scalarRoot, feeRate, initialAnchor) for a network
 * These are the AMM curve parameters used during deployment
 */
export interface MarketParams {
  scalarRoot: bigint;
  feeRate: bigint;
  initialAnchor: bigint;
}

const DEFAULT_MARKET_PARAMS: MarketParams = {
  scalarRoot: BigInt('1000000000000000000'), // 1 WAD
  feeRate: BigInt('3000000000000000'), // 0.3% (0.003 WAD)
  initialAnchor: BigInt('50000000000000000'), // 5% APY (0.05 WAD ln rate)
};

export function getMarketParams(network: NetworkId): MarketParams {
  if (network === 'sepolia') {
    const params = sepoliaAddresses.testSetup.marketParams;
    return {
      scalarRoot: BigInt(params.scalarRoot),
      feeRate: BigInt(params.feeRate),
      // Initial anchor varies per market, use a reasonable default
      initialAnchor: DEFAULT_MARKET_PARAMS.initialAnchor,
    };
  }

  if (network === 'mainnet') {
    const params = mainnetAddresses.marketParams;
    return {
      scalarRoot: BigInt(params.scalarRoot),
      feeRate: BigInt(params.feeRate),
      initialAnchor: BigInt(mainnetAddresses.markets.hrzSTRK.initialAnchor || '0'),
    };
  }

  if (network === 'devnet' && devnetAddresses.marketParams) {
    return {
      scalarRoot: BigInt(devnetAddresses.marketParams.scalarRoot ?? '1000000000000000000'),
      feeRate: BigInt(devnetAddresses.marketParams.feeRate ?? '3000000000000000'),
      initialAnchor: BigInt(devnetAddresses.marketParams.initialAnchor ?? '50000000000000000'),
    };
  }

  return DEFAULT_MARKET_PARAMS;
}

// =============================================================================
// ESTIMATED YIELD APYs
// =============================================================================

// Estimated base APYs for yield tokens
// Note: In production, these should come from an on-chain oracle
// integrated at the smart contract level (e.g., pragma_index_oracle.cairo)
// These should be updated periodically based on actual protocol yields
export const ESTIMATED_YIELD_APYS: Record<string, number> = {
  // wstETH: Lido ETH staking yield (~3.5% as of late 2024)
  wstETH: 0.035,

  // sSTRK: Endur staked STRK yield (~8% estimated)
  sSTRK: 0.08,

  // nstSTRK: Nostra staked STRK yield (~12% estimated)
  nstSTRK: 0.12,

  // hrzSTRK: Horizon Mock Staked STRK (~8% for mainnet testing)
  hrzSTRK: 0.08,
};

// =============================================================================
// FAUCET
// =============================================================================

export interface FaucetInfo {
  faucetAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  dailyLimit: string;
}

/**
 * Get faucet info for mainnet (only available on mainnet for hrzSTRK)
 */
export function getFaucetInfo(network: NetworkId): FaucetInfo | null {
  if (network !== 'mainnet') {
    return null;
  }

  return {
    faucetAddress: mainnetAddresses.contracts.Faucet,
    tokenAddress: mainnetAddresses.tokens.hrzSTRK.address,
    tokenSymbol: mainnetAddresses.tokens.hrzSTRK.symbol,
    tokenName: mainnetAddresses.tokens.hrzSTRK.name,
    dailyLimit: mainnetAddresses.tokens.hrzSTRK.faucetDailyLimit,
  };
}

// Re-export for convenience
export { devnetAddresses, forkAddresses, mainnetAddresses, sepoliaAddresses };
