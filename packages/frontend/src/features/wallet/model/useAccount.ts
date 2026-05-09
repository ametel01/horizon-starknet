'use client';

import { useStarknet } from '@features/wallet';
import { useEffect, useReducer } from 'react';
import { WalletAccount } from 'starknet';

export interface UseAccountReturn {
  address: string | null;
  isConnected: boolean;
  account: WalletAccount | null;
}

export function useAccount(): UseAccountReturn {
  const { provider, wallet, address, isConnected } = useStarknet();
  const [account, dispatchAccount] = useReducer(
    (_current: WalletAccount | null, next: WalletAccount | null) => next,
    null
  );

  useEffect(() => {
    if (!wallet || !address) {
      dispatchAccount(null);
      return;
    }

    // Use the new static connectSilent method instead of deprecated constructor
    WalletAccount.connectSilent(provider, wallet)
      .then((walletAccount) => {
        dispatchAccount(walletAccount);
      })
      .catch(() => {
        dispatchAccount(null);
      });
  }, [provider, wallet, address]);

  return {
    address,
    isConnected,
    account,
  };
}
