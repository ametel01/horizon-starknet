import { createProvider, getNetworkId, type NetworkId } from '@shared/starknet/provider';
import {
  connectWallet,
  disconnectWallet,
  getAccounts,
  getChainId as getWalletChainId,
  type WalletConnection,
} from '@shared/starknet/wallet';
import type { StarknetWindowObject } from '@starknet-io/get-starknet';
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js';
import type { RpcProvider } from 'starknet';

export interface StarknetContextValue {
  // Provider
  provider: RpcProvider;
  network: NetworkId;

  // Wallet - use accessors for reactive values
  wallet: Accessor<StarknetWindowObject | null>;
  address: Accessor<string | null>;
  chainId: Accessor<string | null>;
  isConnected: Accessor<boolean>;
  isConnecting: Accessor<boolean>;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const StarknetContext = createContext<StarknetContextValue>();

export function StarknetProvider(props: ParentProps): ReturnType<typeof StarknetContext.Provider> {
  // Static values - don't need signals
  const network = getNetworkId();
  const provider = createProvider(network);

  // Reactive state using signals
  const [wallet, setWallet] = createSignal<StarknetWindowObject | null>(null);
  const [address, setAddress] = createSignal<string | null>(null);
  const [chainId, setChainId] = createSignal<string | null>(null);
  const [isConnecting, setIsConnecting] = createSignal(false);

  // Derived state using createMemo
  const isConnected = createMemo(() => address() !== null);

  // Handle wallet events - use createEffect for reactive dependencies
  createEffect(() => {
    const currentWallet = wallet();
    if (!currentWallet) return;

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

    currentWallet.on('accountsChanged', handleAccountChange);
    currentWallet.on('networkChanged', handleNetworkChange);

    // Cleanup using onCleanup within the effect
    onCleanup(() => {
      currentWallet.off('accountsChanged', handleAccountChange);
      currentWallet.off('networkChanged', handleNetworkChange);
    });
  });

  // Auto-reconnect on mount
  onMount(() => {
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
  });

  // Actions - regular functions in SolidJS (no useCallback needed)
  const connect = async (): Promise<void> => {
    if (isConnecting()) return;

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
  };

  const disconnect = async (): Promise<void> => {
    await disconnectWallet();
    setWallet(null);
    setAddress(null);
    setChainId(null);
  };

  // Context value - pass signal accessors directly for reactivity
  const value: StarknetContextValue = {
    provider,
    network,
    wallet,
    address,
    chainId,
    isConnected,
    isConnecting,
    connect,
    disconnect,
  };

  return <StarknetContext.Provider value={value}>{props.children}</StarknetContext.Provider>;
}

export function useStarknet(): StarknetContextValue {
  const context = useContext(StarknetContext);
  if (!context) {
    throw new Error('useStarknet must be used within a StarknetProvider');
  }
  return context;
}
