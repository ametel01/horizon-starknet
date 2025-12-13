'use client';

import { useMemo } from 'react';
import { WalletAccount } from 'starknet';

import { useStarknet } from './useStarknet';

export interface UseAccountReturn {
  address: string | null;
  isConnected: boolean;
  account: WalletAccount | null;
}

export function useAccount(): UseAccountReturn {
  const { provider, wallet, address, isConnected } = useStarknet();

  const account = useMemo(() => {
    if (!wallet || !address) {
      return null;
    }

    // Use the static connectSilent method as the constructor is deprecated
    // Note: We return null here and let the component handle async connection
    // For sync access, we use a cached account approach
    try {
      // WalletAccount.connect is async, but we need sync access in useMemo
      // The wallet already has the account connected, so we create a wrapper
      // that will use the wallet's request method for signing
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return new WalletAccount(provider, wallet);
    } catch {
      return null;
    }
  }, [provider, wallet, address]);

  return {
    address,
    isConnected,
    account,
  };
}
