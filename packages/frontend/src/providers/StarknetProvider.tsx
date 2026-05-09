'use client';

import { createProvider, getNetworkId, type NetworkId } from '@shared/starknet/provider';
import {
  connectWallet,
  disconnectWallet,
  getAccounts,
  getChainId as getWalletChainId,
  type WalletConnection,
} from '@shared/starknet/wallet';
import type { StarknetWindowObject } from '@starknet-io/get-starknet';
import { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';
import type { RpcProvider } from 'starknet';

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

interface WalletState {
  wallet: StarknetWindowObject | null;
  address: string | null;
  chainId: string | null;
  isConnecting: boolean;
}

type WalletAction =
  | { type: 'connecting'; value: boolean }
  | { type: 'connected'; wallet: StarknetWindowObject; address: string; chainId: string }
  | { type: 'address-changed'; address: string }
  | { type: 'network-changed'; chainId: string }
  | { type: 'disconnected' };

const EMPTY_WALLET_STATE: WalletState = {
  wallet: null,
  address: null,
  chainId: null,
  isConnecting: false,
};

function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'connecting':
      return { ...state, isConnecting: action.value };
    case 'connected':
      return {
        wallet: action.wallet,
        address: action.address,
        chainId: action.chainId,
        isConnecting: false,
      };
    case 'address-changed':
      return { ...state, address: action.address };
    case 'network-changed':
      return { ...state, chainId: action.chainId };
    case 'disconnected':
      return EMPTY_WALLET_STATE;
  }
}

export function StarknetProvider({ children }: StarknetProviderProps): React.ReactNode {
  const network = useMemo<NetworkId>(() => getNetworkId(), []);
  const provider = useMemo<RpcProvider>(() => createProvider(network), [network]);

  const [walletState, dispatchWallet] = useReducer(walletReducer, EMPTY_WALLET_STATE);
  const { wallet, address, chainId, isConnecting } = walletState;

  const isConnected = address !== null;

  // Handle wallet events
  useEffect(() => {
    if (!wallet) return;

    const handleAccountChange = (accounts?: string[]): void => {
      if (accounts?.[0]) {
        dispatchWallet({ type: 'address-changed', address: accounts[0] });
      } else {
        dispatchWallet({ type: 'disconnected' });
      }
    };

    const handleNetworkChange = (newChainId?: string): void => {
      if (newChainId) {
        dispatchWallet({ type: 'network-changed', chainId: newChainId });
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
              dispatchWallet({
                type: 'connected',
                wallet: silentWallet,
                address: accounts[0],
                chainId: walletChainId,
              });
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

    dispatchWallet({ type: 'connecting', value: true });
    try {
      const connection: WalletConnection | null = await connectWallet();

      if (connection) {
        dispatchWallet({
          type: 'connected',
          wallet: connection.wallet,
          address: connection.address,
          chainId: connection.chainId,
        });
      }
    } finally {
      dispatchWallet({ type: 'connecting', value: false });
    }
  }, [isConnecting]);

  const disconnect = useCallback(async (): Promise<void> => {
    await disconnectWallet();
    dispatchWallet({ type: 'disconnected' });
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
