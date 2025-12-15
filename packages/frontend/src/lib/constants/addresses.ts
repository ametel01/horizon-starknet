import devnetAddressesRaw from '@deploy/addresses/devnet.json';
import forkAddressesRaw from '@deploy/addresses/fork.json';

import type { NetworkId } from '../starknet/provider';

/**
 * Normalize a Starknet address for comparison
 * Converts to lowercase and removes leading zeros after 0x
 */
function normalizeAddress(address: string): string {
  // Remove 0x prefix, strip leading zeros, add back 0x, lowercase
  const hex = address.toLowerCase().replace(/^0x0*/, '');
  return '0x' + hex;
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

export interface ContractAddresses {
  factory: string;
  marketFactory: string;
  router: string;
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
}

// Placeholder for undeployed contracts
const ZERO_ADDRESS = '0x0';

// Core protocol addresses per network
const ADDRESSES: Record<NetworkId, ContractAddresses> = {
  devnet: {
    factory: devnetAddresses.contracts.Factory ?? ZERO_ADDRESS,
    marketFactory: devnetAddresses.contracts.MarketFactory ?? ZERO_ADDRESS,
    router: devnetAddresses.contracts.Router ?? ZERO_ADDRESS,
  },
  fork: {
    factory: forkAddresses.contracts.Factory,
    marketFactory: forkAddresses.contracts.MarketFactory,
    router: forkAddresses.contracts.Router,
  },
  sepolia: {
    // TODO: Update after sepolia deployment
    factory: ZERO_ADDRESS,
    marketFactory: ZERO_ADDRESS,
    router: ZERO_ADDRESS,
  },
  mainnet: {
    // TODO: Update after mainnet deployment
    factory: ZERO_ADDRESS,
    marketFactory: ZERO_ADDRESS,
    router: ZERO_ADDRESS,
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

  return [];
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

// Re-export for convenience
export { devnetAddresses, forkAddresses };
