// Low-level Starknet utilities - provider, contracts, wallet, transaction builder

export * from './contracts';
export * from './provider';
// Transaction builder exports (excluding calculateMinOutput which conflicts with math/amm)
export {
  buildApprovalCall,
  buildDepositAndEarnCalls,
  buildDepositToSyCall,
  buildMintPyCall,
  buildRedeemPtPostExpiryCall,
  buildRedeemPyToSyCall,
  buildUnwrapSyCall,
  buildWithdrawCalls,
  type DepositAndEarnParams,
  estimateDepositCallCount,
  estimateWithdrawCallCount,
  needsApproval,
  type WithdrawParams,
} from './transaction-builder';
// Exclude getChainId from wallet as it conflicts with provider
// Re-export wallet's getChainId with a different name if needed
export {
  connectWallet,
  disconnectWallet,
  formatAddress,
  getAccounts,
  getChainId as getWalletChainId,
  isValidStarknetAddress,
  type WalletConnection,
} from './wallet';
