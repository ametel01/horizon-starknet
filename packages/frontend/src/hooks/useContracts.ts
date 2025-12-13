'use client';

import { useMemo } from 'react';
import type { Contract } from 'starknet';

import {
  getFactoryContract,
  getMarketContract,
  getMarketFactoryContract,
  getPTContract,
  getRouterContract,
  getSYContract,
  getTestMarketContract,
  getTestPTContract,
  getTestSYContract,
  getTestYTContract,
  getYTContract,
} from '@/lib/starknet/contracts';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

export interface UseContractsReturn {
  // Core protocol contracts (for writes, needs account)
  factory: Contract | null;
  marketFactory: Contract | null;
  router: Contract | null;

  // Read-only versions (uses provider)
  factoryRead: Contract;
  marketFactoryRead: Contract;
  routerRead: Contract;

  // Dynamic contract getters
  getMarket: (address: string) => Contract;
  getSY: (address: string) => Contract;
  getPT: (address: string) => Contract;
  getYT: (address: string) => Contract;

  // Test setup contracts (katana only)
  testSY: Contract | null;
  testPT: Contract | null;
  testYT: Contract | null;
  testMarket: Contract | null;
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

  // Test contracts (katana)
  const testSY = useMemo(() => getTestSYContract(provider, network), [provider, network]);
  const testPT = useMemo(() => getTestPTContract(provider, network), [provider, network]);
  const testYT = useMemo(() => getTestYTContract(provider, network), [provider, network]);
  const testMarket = useMemo(() => getTestMarketContract(provider, network), [provider, network]);

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
    testSY,
    testPT,
    testYT,
    testMarket,
  };
}
