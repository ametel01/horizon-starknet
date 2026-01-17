import { getAddresses } from '@shared/config/addresses';
import type { AccountInterface, ProviderInterface, TypedContractV2 } from 'starknet';
import { Contract } from 'starknet';
import {
  FACTORY_ABI,
  MARKET_ABI,
  MARKETFACTORY_ABI,
  PRAGMAINDEXORACLE_ABI,
  PT_ABI,
  PYLPORACLE_ABI,
  ROUTER_ABI,
  ROUTERSTATIC_ABI,
  SY_ABI,
  SYWITHREWARDS_ABI,
  YT_ABI,
} from '@/types/generated';

import type { NetworkId } from './provider';

type ProviderOrAccount = ProviderInterface | AccountInterface;

// Type aliases for typed contracts (exported for use in hooks and components)
export type TypedFactory = TypedContractV2<typeof FACTORY_ABI>;
export type TypedMarketFactory = TypedContractV2<typeof MARKETFACTORY_ABI>;
export type TypedRouter = TypedContractV2<typeof ROUTER_ABI>;
export type TypedRouterStatic = TypedContractV2<typeof ROUTERSTATIC_ABI>;
export type TypedMarket = TypedContractV2<typeof MARKET_ABI>;
export type TypedSY = TypedContractV2<typeof SY_ABI>;
export type TypedSYWithRewards = TypedContractV2<typeof SYWITHREWARDS_ABI>;
export type TypedPT = TypedContractV2<typeof PT_ABI>;
export type TypedYT = TypedContractV2<typeof YT_ABI>;
export type TypedPyLpOracle = TypedContractV2<typeof PYLPORACLE_ABI>;
export type TypedPragmaIndexOracle = TypedContractV2<typeof PRAGMAINDEXORACLE_ABI>;

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

/**
 * Creates a typed RouterStatic contract instance.
 *
 * RouterStatic provides read-only helper functions for querying market state,
 * computing swap previews, and getting token balances without requiring transactions.
 * Returns null if RouterStatic is not deployed on the network (address is 0x0).
 */
export function getRouterStaticContract(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedRouterStatic | null {
  const addresses = getAddresses(network);
  // Return null if RouterStatic is not deployed (placeholder 0x0)
  if (addresses.routerStatic === '0x0') {
    return null;
  }
  return new Contract({
    abi: ROUTERSTATIC_ABI,
    address: addresses.routerStatic,
    providerOrAccount,
  }).typedv2(ROUTERSTATIC_ABI);
}

// Dynamic contracts (address provided at runtime)
/**
 * Creates a typed Market contract instance.
 *
 * Market contracts include reward distribution methods:
 * - get_reward_tokens() - Get list of reward token addresses
 * - accrued_rewards(user) - Get pending rewards for user
 * - claim_rewards(user) - Claim rewards for user
 * - reward_index(token) - Get global reward index for a token
 * - user_reward_index(user, token) - Get user's reward index
 * - is_reward_token(token) - Check if token is a reward token
 * - reward_tokens_count() - Get number of reward tokens
 */
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

// ERC20 contract - uses SY_ABI as it includes ERC20 functions
export function getERC20Contract(address: string, providerOrAccount: ProviderOrAccount): TypedSY {
  return new Contract({ abi: SY_ABI, address, providerOrAccount }).typedv2(SY_ABI);
}

/**
 * Create a typed PyLpOracle contract instance with explicit address.
 *
 * PyLpOracle is a stateless helper that provides TWAP-based pricing
 * for PT, YT, and LP tokens. Use duration=0 for spot rates.
 */
export function getPyLpOracleContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedPyLpOracle {
  return new Contract({ abi: PYLPORACLE_ABI, address, providerOrAccount }).typedv2(PYLPORACLE_ABI);
}

/**
 * Create a typed PyLpOracle contract instance using network config address.
 *
 * Convenience function that looks up the PyLpOracle address from network config.
 * Returns null if PyLpOracle is not deployed on the network (address is 0x0).
 */
export function getPyLpOracleContractForNetwork(
  providerOrAccount: ProviderOrAccount,
  network: NetworkId
): TypedPyLpOracle | null {
  const addresses = getAddresses(network);
  // Return null if PyLpOracle is not deployed (placeholder 0x0)
  if (addresses.pyLpOracle === '0x0') {
    return null;
  }
  return getPyLpOracleContract(addresses.pyLpOracle, providerOrAccount);
}

/**
 * Create a typed PragmaIndexOracle contract instance.
 *
 * PragmaIndexOracle provides the underlying asset exchange rate from Pragma,
 * used by SY contracts to calculate yield. It fetches TWAP prices for the
 * numerator/denominator pair to compute a manipulation-resistant index.
 */
export function getPragmaIndexOracleContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedPragmaIndexOracle {
  return new Contract({ abi: PRAGMAINDEXORACLE_ABI, address, providerOrAccount }).typedv2(
    PRAGMAINDEXORACLE_ABI
  );
}
