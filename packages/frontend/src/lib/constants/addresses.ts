import katanaAddresses from '@deploy/addresses/katana.json';

import type { NetworkId } from '../starknet/provider';

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

// Core protocol addresses per network
const ADDRESSES: Record<NetworkId, ContractAddresses> = {
  katana: {
    factory: katanaAddresses.contracts.Factory,
    marketFactory: katanaAddresses.contracts.MarketFactory,
    router: katanaAddresses.contracts.Router,
  },
  sepolia: {
    // TODO: Update after sepolia deployment
    factory: '0x0',
    marketFactory: '0x0',
    router: '0x0',
  },
  mainnet: {
    // TODO: Update after mainnet deployment
    factory: '0x0',
    marketFactory: '0x0',
    router: '0x0',
  },
};

// Test setup addresses (only for katana)
const TEST_SETUP: Record<NetworkId, TestSetupAddresses | null> = {
  katana: {
    mockYieldToken: katanaAddresses.testSetup.MockYieldToken,
    sy: katanaAddresses.testSetup.SY,
    pt: katanaAddresses.testSetup.PT,
    yt: katanaAddresses.testSetup.YT,
    market: katanaAddresses.testSetup.Market,
    expiry: katanaAddresses.testSetup.expiry,
  },
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
