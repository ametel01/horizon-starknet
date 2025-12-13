import katanaAddressesRaw from '@deploy/addresses/katana.json';

import type { NetworkId } from '../starknet/provider';

// Type definition for the katana.json structure
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
    MockYieldToken?: string;
    SY?: string;
    PT?: string;
    YT?: string;
    Market?: string;
    expiry?: number;
  };
}

const katanaAddresses = katanaAddressesRaw as KatanaAddresses;

export interface ContractAddresses {
  factory: string;
  marketFactory: string;
  router: string;
}

export interface TestSetupAddresses {
  mockYieldToken: string;
  sy: string;
  pt: string;
  yt: string;
  market: string;
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

// Test setup addresses (only for katana)
const TEST_SETUP: Record<NetworkId, TestSetupAddresses | null> = {
  katana: katanaAddresses.testSetup.SY
    ? {
        mockYieldToken: katanaAddresses.testSetup.MockYieldToken ?? ZERO_ADDRESS,
        sy: katanaAddresses.testSetup.SY ?? ZERO_ADDRESS,
        pt: katanaAddresses.testSetup.PT ?? ZERO_ADDRESS,
        yt: katanaAddresses.testSetup.YT ?? ZERO_ADDRESS,
        market: katanaAddresses.testSetup.Market ?? ZERO_ADDRESS,
        expiry: katanaAddresses.testSetup.expiry ?? 0,
      }
    : null,
  sepolia: null,
  mainnet: null,
};

export function getAddresses(network: NetworkId): ContractAddresses {
  return ADDRESSES[network];
}

export function getTestSetup(network: NetworkId): TestSetupAddresses | null {
  return TEST_SETUP[network];
}

// Re-export for convenience
export { katanaAddresses };
