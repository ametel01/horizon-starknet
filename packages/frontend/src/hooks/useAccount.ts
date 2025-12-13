'use client';

import { useEffect, useState } from 'react';
import { WalletAccount } from 'starknet';

import { useStarknet } from './useStarknet';

export interface UseAccountReturn {
  address: string | null;
  isConnected: boolean;
  account: WalletAccount | null;
}

export function useAccount(): UseAccountReturn {
  const { provider, wallet, address, isConnected } = useStarknet();
  const [account, setAccount] = useState<WalletAccount | null>(null);

  useEffect(() => {
    if (!wallet || !address) {
      setAccount(null);
      return;
    }

    // Use the new static connectSilent method instead of deprecated constructor
    WalletAccount.connectSilent(provider, wallet)
      .then((walletAccount) => {
        setAccount(walletAccount);
      })
      .catch(() => {
        setAccount(null);
      });
  }, [provider, wallet, address]);

  return {
    address,
    isConnected,
    account,
  };
}
