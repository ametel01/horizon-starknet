import { getYTContract } from "@shared/starknet/contracts";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import type { Call } from "starknet";
import { useAccount } from "@/features/wallet";

interface ClaimYieldParams {
	ytAddress: string;
}

interface ClaimYieldResult {
	transactionHash: string;
}

export interface UseClaimYieldReturn {
	claimYield: (params: ClaimYieldParams) => void;
	claimYieldAsync: (params: ClaimYieldParams) => Promise<ClaimYieldResult>;
	isClaiming: Accessor<boolean>;
	isSuccess: Accessor<boolean>;
	isError: Accessor<boolean>;
	error: Accessor<Error | null>;
	transactionHash: Accessor<string | undefined>;
	reset: () => void;
}

/**
 * Hook to claim yield from a single YT token.
 *
 * Calls redeem_due_interest on the YT contract to claim
 * accrued interest for the connected wallet.
 */
export function useClaimYield(): UseClaimYieldReturn {
	const { account, address } = useAccount();
	const queryClient = useQueryClient();

	const mutation = createMutation(() => ({
		mutationFn: async (params: ClaimYieldParams): Promise<ClaimYieldResult> => {
			const currentAccount = account();
			const currentAddress = address();

			if (!currentAccount || !currentAddress) {
				throw new Error("Wallet not connected");
			}

			const ytContract = getYTContract(params.ytAddress, currentAccount);

			// Call redeem_due_interest on the YT contract
			const claimCall = ytContract.populate("redeem_due_interest", [
				currentAddress,
			]);

			const calls: Call[] = [claimCall];

			// Execute the call
			const result = await currentAccount.execute(calls);

			return {
				transactionHash: result.transaction_hash,
			};
		},
		onSuccess: () => {
			// Invalidate relevant queries
			void queryClient.invalidateQueries({ queryKey: ["positions"] });
			void queryClient.invalidateQueries({ queryKey: ["token-balance"] });
		},
	}));

	return {
		claimYield: mutation.mutate,
		claimYieldAsync: mutation.mutateAsync,
		isClaiming: createMemo(() => mutation.isPending),
		isSuccess: createMemo(() => mutation.isSuccess),
		isError: createMemo(() => mutation.isError),
		error: createMemo(() => mutation.error),
		transactionHash: createMemo(() => mutation.data?.transactionHash),
		reset: () => mutation.reset(),
	};
}

interface ClaimAllYieldParams {
	ytAddresses: string[];
}

export interface UseClaimAllYieldReturn {
	claimAllYield: (params: ClaimAllYieldParams) => void;
	claimAllYieldAsync: (
		params: ClaimAllYieldParams,
	) => Promise<ClaimYieldResult>;
	isClaiming: Accessor<boolean>;
	isSuccess: Accessor<boolean>;
	isError: Accessor<boolean>;
	error: Accessor<Error | null>;
	transactionHash: Accessor<string | undefined>;
	reset: () => void;
}

/**
 * Hook to claim yield from multiple YT tokens in a single multicall.
 *
 * Batches redeem_due_interest calls for multiple YT addresses
 * into a single transaction for gas efficiency.
 */
export function useClaimAllYield(): UseClaimAllYieldReturn {
	const { account, address } = useAccount();
	const queryClient = useQueryClient();

	const mutation = createMutation(() => ({
		mutationFn: async (
			params: ClaimAllYieldParams,
		): Promise<ClaimYieldResult> => {
			const currentAccount = account();
			const currentAddress = address();

			if (!currentAccount || !currentAddress) {
				throw new Error("Wallet not connected");
			}

			if (params.ytAddresses.length === 0) {
				throw new Error("No YT addresses provided");
			}

			// Build claim calls for each YT
			const calls: Call[] = params.ytAddresses.map((ytAddress) => {
				const ytContract = getYTContract(ytAddress, currentAccount);
				return ytContract.populate("redeem_due_interest", [currentAddress]);
			});

			// Execute all claims in a single multicall
			const result = await currentAccount.execute(calls);

			return {
				transactionHash: result.transaction_hash,
			};
		},
		onSuccess: () => {
			// Invalidate relevant queries
			void queryClient.invalidateQueries({ queryKey: ["positions"] });
			void queryClient.invalidateQueries({ queryKey: ["token-balance"] });
		},
	}));

	return {
		claimAllYield: mutation.mutate,
		claimAllYieldAsync: mutation.mutateAsync,
		isClaiming: createMemo(() => mutation.isPending),
		isSuccess: createMemo(() => mutation.isSuccess),
		isError: createMemo(() => mutation.isError),
		error: createMemo(() => mutation.error),
		transactionHash: createMemo(() => mutation.data?.transactionHash),
		reset: () => mutation.reset(),
	};
}
