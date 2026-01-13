import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { WalletAccount } from 'starknet';
import { useStarknet } from './useStarknet';

export interface UseAccountReturn {
  address: Accessor<string | null>;
  isConnected: Accessor<boolean>;
  account: Accessor<WalletAccount | null>;
}

/**
 * Hook to derive account state from wallet context.
 * Creates a WalletAccount instance when a wallet is connected.
 *
 * @returns Object with reactive accessors for address, isConnected, and account
 */
export function useAccount(): UseAccountReturn {
  const { provider, wallet, address, isConnected } = useStarknet();
  const [account, setAccount] = createSignal<WalletAccount | null>(null);

  // Derived memo to trigger effect when wallet or address changes
  const walletAndAddress = createMemo(() => ({
    wallet: wallet(),
    address: address(),
  }));

  // Effect to create WalletAccount when wallet connects
  createEffect(() => {
    const { wallet: currentWallet, address: currentAddress } = walletAndAddress();

    if (!currentWallet || !currentAddress) {
      setAccount(null);
      return;
    }

    // Track whether effect is still current to prevent race conditions
    let cancelled = false;

    // Use the static connectSilent method to create WalletAccount
    WalletAccount.connectSilent(provider, currentWallet)
      .then((walletAccount) => {
        if (!cancelled) {
          setAccount(walletAccount);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          // biome-ignore lint/suspicious/noConsole: intentional error logging for wallet connection failures
          console.error('Failed to create WalletAccount:', error);
          setAccount(null);
        }
      });

    // Cleanup to prevent stale updates when wallet/address changes
    onCleanup(() => {
      cancelled = true;
    });
  });

  return {
    address,
    isConnected,
    account,
  };
}
