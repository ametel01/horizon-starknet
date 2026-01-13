import {
  getFactoryContract,
  getMarketContract,
  getMarketFactoryContract,
  getPTContract,
  getRouterContract,
  getSYContract,
  getYTContract,
  type TypedFactory,
  type TypedMarket,
  type TypedMarketFactory,
  type TypedPT,
  type TypedRouter,
  type TypedSY,
  type TypedYT,
} from '@shared/starknet/contracts';
import { type Accessor, createMemo } from 'solid-js';
import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

export interface UseContractsReturn {
  // Core protocol contracts (for writes, needs account)
  factory: Accessor<TypedFactory | null>;
  marketFactory: Accessor<TypedMarketFactory | null>;
  router: Accessor<TypedRouter | null>;

  // Read-only versions (uses provider)
  factoryRead: TypedFactory;
  marketFactoryRead: TypedMarketFactory;
  routerRead: TypedRouter;

  // Dynamic contract getters - recreated when account changes
  getMarket: Accessor<(address: string) => TypedMarket>;
  getSY: Accessor<(address: string) => TypedSY>;
  getPT: Accessor<(address: string) => TypedPT>;
  getYT: Accessor<(address: string) => TypedYT>;
}

/**
 * Hook to get typed contract instances.
 * Contract instances with account are recreated when account changes.
 *
 * @returns Object with contract instances and dynamic getters
 */
export function useContracts(): UseContractsReturn {
  const { provider, network } = useStarknet();
  const { account } = useAccount();

  // Core contracts with account (for writes) - reactive to account changes
  const factory = createMemo(() => {
    const acc = account();
    return acc ? getFactoryContract(acc, network) : null;
  });

  const marketFactory = createMemo(() => {
    const acc = account();
    return acc ? getMarketFactoryContract(acc, network) : null;
  });

  const router = createMemo(() => {
    const acc = account();
    return acc ? getRouterContract(acc, network) : null;
  });

  // Read-only contracts (for queries) - static, no account dependency
  const factoryRead = getFactoryContract(provider, network);
  const marketFactoryRead = getMarketFactoryContract(provider, network);
  const routerRead = getRouterContract(provider, network);

  // Dynamic contract getters - return functions that use account when available
  const getMarket = createMemo(() => {
    const acc = account();
    return (address: string) => getMarketContract(address, acc ?? provider);
  });

  const getSY = createMemo(() => {
    const acc = account();
    return (address: string) => getSYContract(address, acc ?? provider);
  });

  const getPT = createMemo(() => {
    const acc = account();
    return (address: string) => getPTContract(address, acc ?? provider);
  });

  const getYT = createMemo(() => {
    const acc = account();
    return (address: string) => getYTContract(address, acc ?? provider);
  });

  return {
    factory,
    marketFactory,
    router,
    factoryRead,
    marketFactoryRead,
    routerRead,
    getMarket,
    getSY,
    getPT,
    getYT,
  };
}
