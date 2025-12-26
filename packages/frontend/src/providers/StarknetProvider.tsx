'use client';

import type { StarknetWindowObject } from '@starknet-io/get-starknet';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { RpcProvider } from 'starknet';

import { createProvider, getNetworkId, type NetworkId } from '@shared/starknet/provider';
import {
  connectWallet,
  disconnectWallet,
  getAccounts,
  getChainId as getWalletChainId,
  type WalletConnection,
} from '@shared/starknet/wallet';

export interface StarknetContextValue {
  // Provider
  provider: RpcProvider;
  network: NetworkId;

  // Wallet
  wallet: StarknetWindowObject | null;
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isConnecting: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const StarknetContext = createContext<StarknetContextValue | null>(null);

interface StarknetProviderProps {
  children: React.ReactNode;
}

export function StarknetProvider({ children }: StarknetProviderProps): React.ReactNode {
  const [network] = useState<NetworkId>(getNetworkId);
  const [provider] = useState<RpcProvider>(() => createProvider(network));

  const [wallet, setWallet] = useState<StarknetWindowObject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = address !== null;

  // Handle wallet events
  useEffect(() => {
    if (!wallet) return;

    const handleAccountChange = (accounts?: string[]): void => {
      if (accounts?.[0]) {
        setAddress(accounts[0]);
      } else {
        setAddress(null);
        setWallet(null);
      }
    };

    const handleNetworkChange = (newChainId?: string): void => {
      if (newChainId) {
        setChainId(newChainId);
      }
    };

    wallet.on('accountsChanged', handleAccountChange);
    wallet.on('networkChanged', handleNetworkChange);

    return () => {
      wallet.off('accountsChanged', handleAccountChange);
      wallet.off('networkChanged', handleNetworkChange);
    };
  }, [wallet]);

  // Auto-reconnect on mount
  useEffect(() => {
    const autoConnect = async (): Promise<void> => {
      try {
        // Check if wallet was previously connected (silent mode)
        const { connect } = await import('@starknet-io/get-starknet');
        const silentWallet = await connect({ modalMode: 'neverAsk' });

        if (silentWallet) {
          try {
            const accounts = await getAccounts(silentWallet);
            if (accounts[0]) {
              const walletChainId = await getWalletChainId(silentWallet);
              setWallet(silentWallet);
              setAddress(accounts[0]);
              setChainId(walletChainId);
            }
          } catch {
            // Wallet not ready or user hasn't approved
          }
        }
      } catch {
        // Silent fail for auto-connect
      }
    };

    void autoConnect();
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    if (isConnecting) return;

    setIsConnecting(true);
    try {
      const connection: WalletConnection | null = await connectWallet();

      if (connection) {
        setWallet(connection.wallet);
        setAddress(connection.address);
        setChainId(connection.chainId);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  const disconnect = useCallback(async (): Promise<void> => {
    await disconnectWallet();
    setWallet(null);
    setAddress(null);
    setChainId(null);
  }, []);

  const value = useMemo<StarknetContextValue>(
    () => ({
      provider,
      network,
      wallet,
      address,
      chainId,
      isConnected,
      isConnecting,
      connect,
      disconnect,
    }),
    [provider, network, wallet, address, chainId, isConnected, isConnecting, connect, disconnect]
  );

  return <StarknetContext.Provider value={value}>{children}</StarknetContext.Provider>;
}
