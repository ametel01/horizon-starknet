// Low-level Starknet utilities - provider, contracts, wallet

export * from './provider';
export * from './contracts';
// Exclude getChainId from wallet as it conflicts with provider
export {
  type WalletConnection,
  connectWallet,
  disconnectWallet,
  getAccounts,
  formatAddress,
  isValidStarknetAddress,
} from './wallet';
// Re-export wallet's getChainId with a different name if needed
export { getChainId as getWalletChainId } from './wallet';
