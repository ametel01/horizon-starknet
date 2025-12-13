import katanaAddressesRaw from '@deploy/addresses/katana.json';

import type { NetworkId } from '../starknet/provider';

// Type definitions for the new dual-market JSON structure
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

interface KatanaAddresses {
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

const katanaAddresses = katanaAddressesRaw as KatanaAddresses;

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
  katana: {
    factory: katanaAddresses.contracts.Factory ?? ZERO_ADDRESS,
    marketFactory: katanaAddresses.contracts.MarketFactory ?? ZERO_ADDRESS,
    router: katanaAddresses.contracts.Router ?? ZERO_ADDRESS,
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
  if (network !== 'katana') return ZERO_ADDRESS;
  return katanaAddresses.testSetup.baseToken?.STRK ?? ZERO_ADDRESS;
}

/**
 * Get test recipient address
 */
export function getTestRecipient(network: NetworkId): string {
  if (network !== 'katana') return ZERO_ADDRESS;
  return katanaAddresses.testSetup.testRecipient ?? ZERO_ADDRESS;
}

// Re-export for convenience
export { katanaAddresses };
