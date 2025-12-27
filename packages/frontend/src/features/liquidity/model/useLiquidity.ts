'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getMarketContract, getRouterContract } from '@shared/starknet/contracts';

interface AddLiquidityParams {
  marketAddress: string;
  syAddress: string;
  ptAddress: string;
  syAmount: bigint;
  ptAmount: bigint;
  minLpOut: bigint;
}

interface RemoveLiquidityParams {
  marketAddress: string;
  lpAmount: bigint;
  minSyOut: bigint;
  minPtOut: bigint;
}

interface LiquidityResult {
  transactionHash: string;
}

interface UseAddLiquidityReturn {
  addLiquidity: (params: AddLiquidityParams) => void;
  addLiquidityAsync: (params: AddLiquidityParams) => Promise<LiquidityResult>;
  isAdding: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

interface UseRemoveLiquidityReturn {
  removeLiquidity: (params: RemoveLiquidityParams) => void;
  removeLiquidityAsync: (params: RemoveLiquidityParams) => Promise<LiquidityResult>;
  isRemoving: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

export function useAddLiquidity(): UseAddLiquidityReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: AddLiquidityParams): Promise<LiquidityResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve SY to router
      const syContract = getERC20Contract(params.syAddress, account);
      const approveSyCall = syContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.syAmount),
      ]);
      calls.push(approveSyCall);

      // Approve PT to router
      const ptContract = getERC20Contract(params.ptAddress, account);
      const approvePtCall = ptContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.ptAmount),
      ]);
      calls.push(approvePtCall);

      // Add liquidity call
      const addLiquidityCall = router.populate('add_liquidity', [
        params.marketAddress,
        address,
        uint256.bnToUint256(params.syAmount),
        uint256.bnToUint256(params.ptAmount),
        uint256.bnToUint256(params.minLpOut),
        getDeadline(),
      ]);
      calls.push(addLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  });

  return {
    addLiquidity: mutation.mutate,
    addLiquidityAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

export function useRemoveLiquidity(): UseRemoveLiquidityReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: RemoveLiquidityParams): Promise<LiquidityResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve LP tokens (market is the LP token) to router
      const marketContract = getMarketContract(params.marketAddress, account);
      const approveLpCall = marketContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.lpAmount),
      ]);
      calls.push(approveLpCall);

      // Remove liquidity call
      const removeLiquidityCall = router.populate('remove_liquidity', [
        params.marketAddress,
        address,
        uint256.bnToUint256(params.lpAmount),
        uint256.bnToUint256(params.minSyOut),
        uint256.bnToUint256(params.minPtOut),
        getDeadline(),
      ]);
      calls.push(removeLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  });

  return {
    removeLiquidity: mutation.mutate,
    removeLiquidityAsync: mutation.mutateAsync,
    isRemoving: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for adding liquidity (for gas estimation)
 */
export function buildAddLiquidityCalls(
  routerAddress: string,
  userAddress: string,
  params: AddLiquidityParams
): Call[] {
  const calls: Call[] = [];

  // Approve SY
  const u256Sy = uint256.bnToUint256(params.syAmount);
  calls.push({
    contractAddress: params.syAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Sy.low, u256Sy.high],
  });

  // Approve PT
  const u256Pt = uint256.bnToUint256(params.ptAmount);
  calls.push({
    contractAddress: params.ptAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Pt.low, u256Pt.high],
  });

  // Add liquidity
  const u256MinLp = uint256.bnToUint256(params.minLpOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'add_liquidity',
    calldata: [
      params.marketAddress,
      userAddress,
      u256Sy.low,
      u256Sy.high,
      u256Pt.low,
      u256Pt.high,
      u256MinLp.low,
      u256MinLp.high,
      getDeadline().toString(),
    ],
  });

  return calls;
}

/**
 * Build calls for removing liquidity (for gas estimation)
 */
export function buildRemoveLiquidityCalls(
  routerAddress: string,
  userAddress: string,
  params: RemoveLiquidityParams
): Call[] {
  const calls: Call[] = [];

  // Approve LP tokens
  const u256Lp = uint256.bnToUint256(params.lpAmount);
  calls.push({
    contractAddress: params.marketAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Lp.low, u256Lp.high],
  });

  // Remove liquidity
  const u256MinSy = uint256.bnToUint256(params.minSyOut);
  const u256MinPt = uint256.bnToUint256(params.minPtOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'remove_liquidity',
    calldata: [
      params.marketAddress,
      userAddress,
      u256Lp.low,
      u256Lp.high,
      u256MinSy.low,
      u256MinSy.high,
      u256MinPt.low,
      u256MinPt.high,
      getDeadline().toString(),
    ],
  });

  return calls;
}

/**
 * Calculate minimum LP output with slippage protection
 * For simplicity, we estimate LP based on the smaller proportion of the deposit
 */
export function calculateMinLpOut(
  syAmount: bigint,
  ptAmount: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  totalLpSupply: bigint,
  slippageBps: number
): bigint {
  if (syReserve === BigInt(0) || ptReserve === BigInt(0) || totalLpSupply === BigInt(0)) {
    // Initial liquidity - use the smaller amount as a conservative estimate
    // In practice, LP = sqrt(syAmount * ptAmount), but sqrt is complex for bigint
    const minAmount = syAmount < ptAmount ? syAmount : ptAmount;
    const slippageMultiplier = BigInt(10000 - slippageBps);
    return (minAmount * slippageMultiplier) / BigInt(10000);
  }

  // Calculate LP based on proportional contribution
  const lpFromSy = (syAmount * totalLpSupply) / syReserve;
  const lpFromPt = (ptAmount * totalLpSupply) / ptReserve;

  // Take the smaller to ensure we don't over-promise
  const expectedLp = lpFromSy < lpFromPt ? lpFromSy : lpFromPt;

  // Apply slippage
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (expectedLp * slippageMultiplier) / BigInt(10000);
}

/**
 * Calculate minimum SY and PT output when removing liquidity
 */
export function calculateMinOutputs(
  lpAmount: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  totalLpSupply: bigint,
  slippageBps: number
): { minSyOut: bigint; minPtOut: bigint } {
  if (totalLpSupply === BigInt(0)) {
    return { minSyOut: BigInt(0), minPtOut: BigInt(0) };
  }

  // Calculate proportional share
  const expectedSy = (lpAmount * syReserve) / totalLpSupply;
  const expectedPt = (lpAmount * ptReserve) / totalLpSupply;

  // Apply slippage
  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minSyOut = (expectedSy * slippageMultiplier) / BigInt(10000);
  const minPtOut = (expectedPt * slippageMultiplier) / BigInt(10000);

  return { minSyOut, minPtOut };
}

/**
 * Calculate balanced deposit amounts based on current pool ratio
 */
export function calculateBalancedAmounts(
  inputAmount: bigint,
  inputIsSy: boolean,
  syReserve: bigint,
  ptReserve: bigint
): { syAmount: bigint; ptAmount: bigint } {
  if (syReserve === BigInt(0) || ptReserve === BigInt(0)) {
    // No existing ratio, use 1:1
    return { syAmount: inputAmount, ptAmount: inputAmount };
  }

  if (inputIsSy) {
    // Calculate PT needed for given SY
    const ptAmount = (inputAmount * ptReserve) / syReserve;
    return { syAmount: inputAmount, ptAmount };
  } else {
    // Calculate SY needed for given PT
    const syAmount = (inputAmount * syReserve) / ptReserve;
    return { syAmount, ptAmount: inputAmount };
  }
}
