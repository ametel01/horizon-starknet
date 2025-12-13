import { RpcProvider } from 'starknet';

export type NetworkId = 'mainnet' | 'sepolia' | 'katana';

const RPC_URLS: Record<NetworkId, string> = {
  mainnet:
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7',
  sepolia:
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7',
  katana: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:5050',
};

const CHAIN_IDS: Record<NetworkId, string> = {
  mainnet: '0x534e5f4d41494e',
  sepolia: '0x534e5f5345504f4c4941',
  katana: '0x4b4154414e41', // "KATANA" in hex
};

export function getNetworkId(): NetworkId {
  const network = process.env.NEXT_PUBLIC_NETWORK;
  if (network === 'mainnet' || network === 'sepolia' || network === 'katana') {
    return network;
  }
  return 'katana'; // Default to katana for local development
}

export function createProvider(network?: NetworkId): RpcProvider {
  const networkId = network ?? getNetworkId();
  return new RpcProvider({
    nodeUrl: RPC_URLS[networkId],
    batch: 0, // Enable auto-batching for efficient multicalls
  });
}

export function getChainId(network?: NetworkId): string {
  const networkId = network ?? getNetworkId();
  return CHAIN_IDS[networkId];
}

export function getExplorerUrl(network?: NetworkId): string {
  const networkId = network ?? getNetworkId();
  switch (networkId) {
    case 'mainnet':
      return 'https://starkscan.co';
    case 'sepolia':
      return 'https://sepolia.starkscan.co';
    case 'katana':
      return ''; // No explorer for local katana
  }
}

export function getExplorerTxUrl(txHash: string, network?: NetworkId): string {
  const baseUrl = getExplorerUrl(network);
  if (!baseUrl) return '';
  return `${baseUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string, network?: NetworkId): string {
  const baseUrl = getExplorerUrl(network);
  if (!baseUrl) return '';
  return `${baseUrl}/contract/${address}`;
}
