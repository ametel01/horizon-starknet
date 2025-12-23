import { RpcProvider, type BlockTag, type Call, type CallContractResponse } from 'starknet';

export type NetworkId = 'mainnet' | 'sepolia' | 'devnet' | 'fork';

const RPC_URLS: Record<NetworkId, string> = {
  mainnet:
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7',
  sepolia:
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7',
  devnet: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:5050',
  fork: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:5050',
};

const CHAIN_IDS: Record<NetworkId, string> = {
  mainnet: '0x534e5f4d41494e',
  sepolia: '0x534e5f5345504f4c4941',
  devnet: '0x534e5f5345504f4c4941', // starknet-devnet-rs uses SN_SEPOLIA chain ID
  fork: '0x534e5f4d41494e', // fork mode uses mainnet chain ID
};

// Use 'latest' for networks where 'pending' isn't well supported
const DEFAULT_BLOCK: Record<NetworkId, BlockTag> = {
  mainnet: 'latest', // Alchemy doesn't support 'pending' for mainnet
  sepolia: 'latest', // Alchemy doesn't support 'pending' for Sepolia
  devnet: 'latest',
  fork: 'latest',
};

export function getNetworkId(): NetworkId {
  const network = process.env.NEXT_PUBLIC_NETWORK;
  if (
    network === 'mainnet' ||
    network === 'sepolia' ||
    network === 'devnet' ||
    network === 'fork'
  ) {
    return network;
  }
  return 'devnet'; // Default to devnet for local development
}

export function getDefaultBlock(network?: NetworkId): BlockTag {
  const networkId = network ?? getNetworkId();
  return DEFAULT_BLOCK[networkId];
}

/**
 * Custom RpcProvider that uses 'latest' block tag for devnet
 * (starknet-devnet-rs doesn't support 'pending')
 */
class DevnetRpcProvider extends RpcProvider {
  private defaultBlockTag: BlockTag;

  constructor(nodeUrl: string, defaultBlock: BlockTag) {
    super({ nodeUrl, batch: 0 });
    this.defaultBlockTag = defaultBlock;
  }

  async callContract(call: Call, blockIdentifier?: BlockTag): Promise<CallContractResponse> {
    // Use our default block if none specified
    const block = blockIdentifier ?? this.defaultBlockTag;
    return super.callContract(call, block);
  }
}

export function createProvider(network?: NetworkId): RpcProvider {
  const networkId = network ?? getNetworkId();
  const defaultBlock = DEFAULT_BLOCK[networkId];

  // Use custom provider for all networks to ensure consistent block tag handling
  // Alchemy doesn't support 'pending' block tag for most networks
  return new DevnetRpcProvider(RPC_URLS[networkId], defaultBlock);
}

export function getChainId(network?: NetworkId): string {
  const networkId = network ?? getNetworkId();
  return CHAIN_IDS[networkId];
}

export function getExplorerUrl(network?: NetworkId): string {
  const networkId = network ?? getNetworkId();
  switch (networkId) {
    case 'mainnet':
      return 'https://voyager.online';
    case 'sepolia':
      return 'https://sepolia.voyager.online';
    case 'devnet':
    case 'fork':
      return ''; // No explorer for local devnet/fork
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
