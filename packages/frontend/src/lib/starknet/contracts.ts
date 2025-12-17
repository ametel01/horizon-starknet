import type { AccountInterface, ProviderInterface, TypedContractV2 } from 'starknet';
import { Contract } from 'starknet';

import {
  FACTORY_ABI,
  FAUCET_ABI,
  MARKET_ABI,
  MARKETFACTORY_ABI,
  MOCKYIELDTOKEN_ABI,
  PT_ABI,
  ROUTER_ABI,
  SY_ABI,
  YT_ABI,
} from '@/types/generated';

import { getAddresses } from '../constants/addresses';

import { type NetworkId } from './provider';

type ProviderOrAccount = ProviderInterface | AccountInterface;

// Type aliases for typed contracts (exported for use in hooks and components)
export type TypedFactory = TypedContractV2<typeof FACTORY_ABI>;
export type TypedMarketFactory = TypedContractV2<typeof MARKETFACTORY_ABI>;
export type TypedRouter = TypedContractV2<typeof ROUTER_ABI>;
export type TypedMarket = TypedContractV2<typeof MARKET_ABI>;
export type TypedSY = TypedContractV2<typeof SY_ABI>;
export type TypedPT = TypedContractV2<typeof PT_ABI>;
export type TypedYT = TypedContractV2<typeof YT_ABI>;
export type TypedMockYieldToken = TypedContractV2<typeof MOCKYIELDTOKEN_ABI>;
export type TypedFaucet = TypedContractV2<typeof FAUCET_ABI>;

/**
 * Creates a type-safe contract instance using abi-wan-kanabi types.
 *
 * Usage:
 * ```typescript
 * const router = getRouterContract(account, network);
 * const [pt, yt] = await router.mint_py_from_sy(ytAddr, receiver, amount, minOut);
 * // TypeScript knows the return type is [bigint, bigint]
 * ```
 */

// Core protocol contracts with full type safety
export function getFactoryContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedFactory {
  const addresses = getAddresses(network);
  return new Contract(FACTORY_ABI, addresses.factory, providerOrAccount).typedv2(FACTORY_ABI);
}

export function getMarketFactoryContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedMarketFactory {
  const addresses = getAddresses(network);
  return new Contract(MARKETFACTORY_ABI, addresses.marketFactory, providerOrAccount).typedv2(
    MARKETFACTORY_ABI
  );
}

export function getRouterContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedRouter {
  const addresses = getAddresses(network);
  return new Contract(ROUTER_ABI, addresses.router, providerOrAccount).typedv2(ROUTER_ABI);
}

// Dynamic contracts (address provided at runtime)
export function getMarketContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedMarket {
  return new Contract(MARKET_ABI, address, providerOrAccount).typedv2(MARKET_ABI);
}

export function getSYContract(address: string, providerOrAccount: ProviderOrAccount): TypedSY {
  return new Contract(SY_ABI, address, providerOrAccount).typedv2(SY_ABI);
}

export function getPTContract(address: string, providerOrAccount: ProviderOrAccount): TypedPT {
  return new Contract(PT_ABI, address, providerOrAccount).typedv2(PT_ABI);
}

export function getYTContract(address: string, providerOrAccount: ProviderOrAccount): TypedYT {
  return new Contract(YT_ABI, address, providerOrAccount).typedv2(YT_ABI);
}

export function getMockYieldTokenContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedMockYieldToken {
  return new Contract(MOCKYIELDTOKEN_ABI, address, providerOrAccount).typedv2(MOCKYIELDTOKEN_ABI);
}

// ERC20 contract - uses SY_ABI as it includes ERC20 functions
export function getERC20Contract(address: string, providerOrAccount: ProviderOrAccount): TypedSY {
  return new Contract(SY_ABI, address, providerOrAccount).typedv2(SY_ABI);
}

// Faucet contract for test tokens
export function getFaucetContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedFaucet {
  return new Contract(FAUCET_ABI, address, providerOrAccount).typedv2(FAUCET_ABI);
}
