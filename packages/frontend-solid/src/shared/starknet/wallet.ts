import { logError } from '@shared/server/logger';
import type { StarknetWindowObject } from '@starknet-io/get-starknet';
import { connect, disconnect } from '@starknet-io/get-starknet';

export interface WalletConnection {
  wallet: StarknetWindowObject;
  address: string;
  chainId: string;
}

export async function connectWallet(): Promise<WalletConnection | null> {
  try {
    const wallet = await connect({
      modalMode: 'alwaysAsk',
      modalTheme: 'dark',
    });

    if (!wallet) {
      return null;
    }

    // Request accounts using the new wallet API
    const accounts = await wallet.request({ type: 'wallet_requestAccounts' });
    const chainId = await wallet.request({ type: 'wallet_requestChainId' });

    const address = accounts[0];

    if (!address) {
      return null;
    }

    return {
      wallet,
      address,
      chainId,
    };
  } catch (error) {
    logError(error, { module: 'wallet', action: 'connect' });
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    await disconnect();
  } catch (error) {
    logError(error, { module: 'wallet', action: 'disconnect' });
  }
}

export async function getAccounts(wallet: StarknetWindowObject): Promise<string[]> {
  return wallet.request({ type: 'wallet_requestAccounts' });
}

export async function getChainId(wallet: StarknetWindowObject): Promise<string> {
  return wallet.request({ type: 'wallet_requestChainId' });
}

export function formatAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) {
    return address;
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function isValidStarknetAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(address);
}
