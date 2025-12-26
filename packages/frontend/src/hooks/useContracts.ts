'use client';

import { useMemo } from 'react';

import {
  getFactoryContract,
  getMarketContract,
  getMarketFactoryContract,
  getPTContract,
  getRouterContract,
  getSYContract,
  getYTContract,
  getMockYieldTokenContract,
  type TypedFactory,
  type TypedMarket,
  type TypedMarketFactory,
  type TypedPT,
  type TypedRouter,
  type TypedSY,
  type TypedYT,
  type TypedMockYieldToken,
} from '@shared/starknet/contracts';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

export interface UseContractsReturn {
  // Core protocol contracts (for writes, needs account)
  factory: TypedFactory | null;
  marketFactory: TypedMarketFactory | null;
  router: TypedRouter | null;

  // Read-only versions (uses provider)
  factoryRead: TypedFactory;
  marketFactoryRead: TypedMarketFactory;
  routerRead: TypedRouter;

  // Dynamic contract getters
  getMarket: (address: string) => TypedMarket;
  getSY: (address: string) => TypedSY;
  getPT: (address: string) => TypedPT;
  getYT: (address: string) => TypedYT;
  getMockYieldToken: (address: string) => TypedMockYieldToken;
}

export function useContracts(): UseContractsReturn {
  const { provider, network } = useStarknet();
  const { account } = useAccount();

  // Core contracts with account (for writes)
  const factory = useMemo(
    () => (account ? getFactoryContract(account, network) : null),
    [account, network]
  );

  const marketFactory = useMemo(
    () => (account ? getMarketFactoryContract(account, network) : null),
    [account, network]
  );

  const router = useMemo(
    () => (account ? getRouterContract(account, network) : null),
    [account, network]
  );

  // Read-only contracts (for queries)
  const factoryRead = useMemo(() => getFactoryContract(provider, network), [provider, network]);

  const marketFactoryRead = useMemo(
    () => getMarketFactoryContract(provider, network),
    [provider, network]
  );

  const routerRead = useMemo(() => getRouterContract(provider, network), [provider, network]);

  // Dynamic contract getters
  const getMarket = useMemo(
    () => (address: string) => getMarketContract(address, account ?? provider),
    [account, provider]
  );

  const getSY = useMemo(
    () => (address: string) => getSYContract(address, account ?? provider),
    [account, provider]
  );

  const getPT = useMemo(
    () => (address: string) => getPTContract(address, account ?? provider),
    [account, provider]
  );

  const getYT = useMemo(
    () => (address: string) => getYTContract(address, account ?? provider),
    [account, provider]
  );

  const getMockYieldToken = useMemo(
    () => (address: string) => getMockYieldTokenContract(address, account ?? provider),
    [account, provider]
  );

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
    getMockYieldToken,
  };
}
