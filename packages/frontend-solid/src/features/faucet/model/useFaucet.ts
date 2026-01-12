import { getFaucetInfo } from '@shared/config/addresses';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { createMemo, type Accessor } from 'solid-js';
import { type Call, Contract, type ProviderInterface } from 'starknet';

import { useAccount, useStarknet } from '@/features/wallet';

/**
 * Minimal Faucet ABI for can_mint and mint functions.
 *
 * Note: Faucet is test infrastructure, not a production contract, so its ABI
 * is not included in the generated types. This inline definition provides
 * only the two functions needed for this feature.
 */
const FAUCET_ABI = [
  {
    type: 'function',
    name: 'can_mint',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [],
    outputs: [],
    state_mutability: 'external',
  },
] as const;

function getFaucetContract(address: string, provider: ProviderInterface): Contract {
  return new Contract({ abi: FAUCET_ABI, address, providerOrAccount: provider });
}

export interface FaucetResult {
  transactionHash: string;
}

export interface UseFaucetReturn {
  // Query state
  canMint: Accessor<boolean | null>;
  isCheckingEligibility: Accessor<boolean>;
  eligibilityError: Accessor<Error | null>;

  // Mutation state
  mint: () => void;
  mintAsync: () => Promise<FaucetResult>;
  isMinting: Accessor<boolean>;
  isSuccess: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  transactionHash: Accessor<string | undefined>;
  reset: () => void;

  // Faucet info
  faucetAvailable: Accessor<boolean>;
  tokenSymbol: Accessor<string>;
  tokenAddress: Accessor<string>;
}

/**
 * Hook for interacting with the Horizon faucet on mainnet.
 * Provides eligibility checking and minting functionality.
 *
 * Uses @tanstack/solid-query for:
 * - Eligibility checking via createQuery
 * - Mint transaction via createMutation
 * - Automatic cache invalidation on settlement
 *
 * @returns Object with reactive accessors for faucet state and actions
 */
export function useFaucet(): UseFaucetReturn {
  const { network, provider } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  // Get faucet info for current network
  const faucetInfo = createMemo(() => getFaucetInfo(network));

  // Derived accessors for faucet info
  const faucetAvailable = createMemo(() => faucetInfo() !== null);
  const tokenSymbol = createMemo(() => faucetInfo()?.tokenSymbol ?? '');
  const tokenAddress = createMemo(() => faucetInfo()?.tokenAddress ?? '');

  // Query to check if user can mint
  const eligibilityQuery = createQuery(() => ({
    queryKey: ['faucet-eligibility', address()],
    queryFn: async (): Promise<boolean> => {
      const currentAddress = address();
      const info = faucetInfo();

      if (!info || !currentAddress) {
        return false;
      }

      const faucet = getFaucetContract(info.faucetAddress, provider);
      // biome-ignore lint/complexity/useLiteralKeys: Contract methods are dynamically typed from ABI
      const result = await faucet['can_mint'](currentAddress);
      // Starknet returns booleans as bigint (0n/1n) for untyped contracts
      return result === 1n || result === true;
    },
    enabled: faucetAvailable() && !!address(),
    staleTime: 30_000, // 30 seconds
  }));

  // Mutation to mint tokens
  const mintMutation = createMutation(() => ({
    mutationFn: async (): Promise<FaucetResult> => {
      const currentAccount = account();
      const info = faucetInfo();

      if (!currentAccount) {
        throw new Error('Wallet not connected');
      }

      if (!info) {
        throw new Error('Faucet not available on this network');
      }

      const mintCall: Call = {
        contractAddress: info.faucetAddress,
        entrypoint: 'mint',
        calldata: [],
      };

      const result = await currentAccount.execute([mintCall]);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    onSuccess: () => {
      // Invalidate eligibility query after successful mint
      void queryClient.invalidateQueries({ queryKey: ['faucet-eligibility'] });
      // Invalidate token balances
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
    },
  }));

  return {
    // Query state
    canMint: createMemo(() => eligibilityQuery.data ?? null),
    isCheckingEligibility: createMemo(() => eligibilityQuery.isPending),
    eligibilityError: createMemo(() => eligibilityQuery.error),

    // Mutation state
    mint: mintMutation.mutate,
    mintAsync: mintMutation.mutateAsync,
    isMinting: createMemo(() => mintMutation.isPending),
    isSuccess: createMemo(() => mintMutation.isSuccess),
    isError: createMemo(() => mintMutation.isError),
    error: createMemo(() => mintMutation.error),
    transactionHash: createMemo(() => mintMutation.data?.transactionHash),
    reset: mintMutation.reset,

    // Faucet info
    faucetAvailable,
    tokenSymbol,
    tokenAddress,
  };
}
