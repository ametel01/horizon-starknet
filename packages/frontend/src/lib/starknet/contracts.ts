import type { Abi, AccountInterface, ProviderInterface } from 'starknet';
import { Contract } from 'starknet';

import {
  ERC20_ABI,
  FACTORY_ABI,
  MARKET_ABI,
  MARKET_FACTORY_ABI,
  MOCK_YIELD_TOKEN_ABI,
  PT_ABI,
  ROUTER_ABI,
  SY_ABI,
  YT_ABI,
} from '../constants/abis';
import { getAddresses, getTestSetup } from '../constants/addresses';

import { type NetworkId } from './provider';

type ProviderOrAccount = ProviderInterface | AccountInterface;

// Contract factory functions
export function createContract(
  abi: Abi,
  address: string,
  providerOrAccount: ProviderOrAccount
): Contract {
  return new Contract(abi, address, providerOrAccount);
}

// Core protocol contracts
export function getFactoryContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract {
  const addresses = getAddresses(network);
  return createContract(FACTORY_ABI, addresses.factory, providerOrAccount);
}

export function getMarketFactoryContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract {
  const addresses = getAddresses(network);
  return createContract(MARKET_FACTORY_ABI, addresses.marketFactory, providerOrAccount);
}

export function getRouterContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract {
  const addresses = getAddresses(network);
  return createContract(ROUTER_ABI, addresses.router, providerOrAccount);
}

// Dynamic contracts (address provided at runtime)
export function getMarketContract(address: string, providerOrAccount: ProviderOrAccount): Contract {
  return createContract(MARKET_ABI, address, providerOrAccount);
}

export function getSYContract(address: string, providerOrAccount: ProviderOrAccount): Contract {
  return createContract(SY_ABI, address, providerOrAccount);
}

export function getPTContract(address: string, providerOrAccount: ProviderOrAccount): Contract {
  return createContract(PT_ABI, address, providerOrAccount);
}

export function getYTContract(address: string, providerOrAccount: ProviderOrAccount): Contract {
  return createContract(YT_ABI, address, providerOrAccount);
}

export function getERC20Contract(address: string, providerOrAccount: ProviderOrAccount): Contract {
  return createContract(ERC20_ABI, address, providerOrAccount);
}

// Test setup contracts (katana only)
export function getMockYieldTokenContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract | null {
  const testSetup = getTestSetup(network);
  if (!testSetup) return null;
  return createContract(MOCK_YIELD_TOKEN_ABI, testSetup.mockYieldToken, providerOrAccount);
}

export function getTestSYContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract | null {
  const testSetup = getTestSetup(network);
  if (!testSetup) return null;
  return createContract(SY_ABI, testSetup.sy, providerOrAccount);
}

export function getTestPTContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract | null {
  const testSetup = getTestSetup(network);
  if (!testSetup) return null;
  return createContract(PT_ABI, testSetup.pt, providerOrAccount);
}

export function getTestYTContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract | null {
  const testSetup = getTestSetup(network);
  if (!testSetup) return null;
  return createContract(YT_ABI, testSetup.yt, providerOrAccount);
}

export function getTestMarketContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): Contract | null {
  const testSetup = getTestSetup(network);
  if (!testSetup) return null;
  return createContract(MARKET_ABI, testSetup.market, providerOrAccount);
}
