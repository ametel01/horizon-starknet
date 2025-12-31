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
  SYWITHREWARDS_ABI,
  YT_ABI,
} from '@/types/generated';
import { getAddresses } from '@shared/config/addresses';

import { type NetworkId } from './provider';

type ProviderOrAccount = ProviderInterface | AccountInterface;

// Type aliases for typed contracts (exported for use in hooks and components)
export type TypedFactory = TypedContractV2<typeof FACTORY_ABI>;
export type TypedMarketFactory = TypedContractV2<typeof MARKETFACTORY_ABI>;
export type TypedRouter = TypedContractV2<typeof ROUTER_ABI>;
export type TypedMarket = TypedContractV2<typeof MARKET_ABI>;
export type TypedSY = TypedContractV2<typeof SY_ABI>;
export type TypedSYWithRewards = TypedContractV2<typeof SYWITHREWARDS_ABI>;
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
  return new Contract({
    abi: FACTORY_ABI,
    address: addresses.factory,
    providerOrAccount,
  }).typedv2(FACTORY_ABI);
}

export function getMarketFactoryContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedMarketFactory {
  const addresses = getAddresses(network);
  return new Contract({
    abi: MARKETFACTORY_ABI,
    address: addresses.marketFactory,
    providerOrAccount,
  }).typedv2(MARKETFACTORY_ABI);
}

export function getRouterContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedRouter {
  const addresses = getAddresses(network);
  return new Contract({
    abi: ROUTER_ABI,
    address: addresses.router,
    providerOrAccount,
  }).typedv2(ROUTER_ABI);
}

// Dynamic contracts (address provided at runtime)
export function getMarketContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedMarket {
  return new Contract({ abi: MARKET_ABI, address, providerOrAccount }).typedv2(MARKET_ABI);
}

export function getSYContract(address: string, providerOrAccount: ProviderOrAccount): TypedSY {
  return new Contract({ abi: SY_ABI, address, providerOrAccount }).typedv2(SY_ABI);
}

/**
 * Creates a typed SYWithRewards contract instance.
 * Use this for SY tokens that support reward distribution (e.g., staking rewards).
 *
 * Additional methods available:
 * - get_reward_tokens() - Get list of reward token addresses
 * - accrued_rewards(user) - Get pending rewards for user
 * - claim_rewards(user) - Claim rewards for user
 * - is_paused() - Check if contract is paused
 * - get_exchange_rate_watermark() - Get the exchange rate high-water mark
 */
export function getSYWithRewardsContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedSYWithRewards {
  return new Contract({ abi: SYWITHREWARDS_ABI, address, providerOrAccount }).typedv2(
    SYWITHREWARDS_ABI
  );
}

export function getPTContract(address: string, providerOrAccount: ProviderOrAccount): TypedPT {
  return new Contract({ abi: PT_ABI, address, providerOrAccount }).typedv2(PT_ABI);
}

export function getYTContract(address: string, providerOrAccount: ProviderOrAccount): TypedYT {
  return new Contract({ abi: YT_ABI, address, providerOrAccount }).typedv2(YT_ABI);
}

export function getMockYieldTokenContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedMockYieldToken {
  return new Contract({ abi: MOCKYIELDTOKEN_ABI, address, providerOrAccount }).typedv2(
    MOCKYIELDTOKEN_ABI
  );
}

// ERC20 contract - uses SY_ABI as it includes ERC20 functions
export function getERC20Contract(address: string, providerOrAccount: ProviderOrAccount): TypedSY {
  return new Contract({ abi: SY_ABI, address, providerOrAccount }).typedv2(SY_ABI);
}

// Faucet contract for test tokens
export function getFaucetContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedFaucet {
  return new Contract({ abi: FAUCET_ABI, address, providerOrAccount }).typedv2(FAUCET_ABI);
}
