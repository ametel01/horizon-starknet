import devnetAddressesRaw from '@deploy/addresses/devnet.json';

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
  if (network !== 'devnet') return ZERO_ADDRESS;
  return devnetAddresses.testSetup.baseToken?.STRK ?? ZERO_ADDRESS;
}

/**
 * Get test recipient address
 */
export function getTestRecipient(network: NetworkId): string {
  if (network !== 'devnet') return ZERO_ADDRESS;
  return devnetAddresses.testSetup.testRecipient ?? ZERO_ADDRESS;
}

/**
 * Get all market infos with token metadata for a network
 */
export function getMarketInfos(network: NetworkId): MarketInfo[] {
  if (network !== 'devnet') return [];

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
export { devnetAddresses };
