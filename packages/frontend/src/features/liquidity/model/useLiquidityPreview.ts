'use client';

import { useStarknet } from '@features/wallet';
import { toBigInt } from '@shared/lib';
import { getRouterStaticContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Direction of the liquidity preview
 */
export type LiquidityPreviewDirection = 'add' | 'remove';

/**
 * Result of an add liquidity preview
 */
export interface AddLiquidityPreviewResult {
  /** Expected LP tokens to receive */
  expectedLpOut: bigint;
  /** The SY input amount used for preview */
  syAmount: bigint;
}

/**
 * Result of a remove liquidity preview
 */
export interface RemoveLiquidityPreviewResult {
  /** Expected SY output from removing liquidity */
  expectedSyOut: bigint;
  /** The LP input amount used for preview */
  lpAmount: bigint;
}

interface UseLiquidityPreviewOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to preview adding liquidity with single-sided SY using RouterStatic.
 *
 * Uses on-chain `preview_add_liquidity_single_sy` function from RouterStatic
 * to get expected LP output for accurate slippage calculation.
 *
 * @param marketAddress - The market contract address
 * @param syAmount - Amount of SY to add as liquidity
 * @param options - Query options
 * @returns Query result with expected LP output, or null if RouterStatic unavailable
 *
 * @example
 * ```typescript
 * const { data: preview } = useAddLiquidityPreview(marketAddress, syAmount);
 *
 * if (preview) {
 *   // Calculate min LP out with 0.5% slippage
 *   const minLpOut = (preview.expectedLpOut * 995n) / 1000n;
 * }
 * ```
 *
 * @see i_router_static.cairo lines 81-83 (preview_add_liquidity_single_sy)
 */
export function useAddLiquidityPreview(
  marketAddress: string | undefined,
  syAmount: bigint | undefined,
  options: UseLiquidityPreviewOptions = {}
): UseQueryResult<AddLiquidityPreviewResult | null> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['liquidity-preview', 'add', marketAddress, syAmount?.toString(), network],
    queryFn: async (): Promise<AddLiquidityPreviewResult | null> => {
      // These conditions are enforced by the `enabled` flag, but TypeScript needs the assertion
      if (!marketAddress || syAmount === undefined) {
        throw new Error('Market address and SY amount are required');
      }

      const routerStatic = getRouterStaticContract(provider, network);

      // RouterStatic not deployed on this network
      if (!routerStatic) {
        return null;
      }

      const rawOutput = await routerStatic.preview_add_liquidity_single_sy(marketAddress, syAmount);
      const expectedLpOut = toBigInt(rawOutput);

      return {
        expectedLpOut,
        syAmount,
      };
    },
    enabled: enabled && !!marketAddress && syAmount !== undefined && syAmount > 0n,
    refetchInterval,
    staleTime: 15000, // Consider data stale after 15 seconds - market state changes
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}

/**
 * Hook to preview removing liquidity to single-sided SY using RouterStatic.
 *
 * Uses on-chain `preview_remove_liquidity_single_sy` function from RouterStatic
 * to get expected SY output for accurate slippage calculation.
 *
 * @param marketAddress - The market contract address
 * @param lpAmount - Amount of LP tokens to burn
 * @param options - Query options
 * @returns Query result with expected SY output, or null if RouterStatic unavailable
 *
 * @example
 * ```typescript
 * const { data: preview } = useRemoveLiquidityPreview(marketAddress, lpAmount);
 *
 * if (preview) {
 *   // Calculate min SY out with 0.5% slippage
 *   const minSyOut = (preview.expectedSyOut * 995n) / 1000n;
 * }
 * ```
 *
 * @see i_router_static.cairo lines 92-94 (preview_remove_liquidity_single_sy)
 */
export function useRemoveLiquidityPreview(
  marketAddress: string | undefined,
  lpAmount: bigint | undefined,
  options: UseLiquidityPreviewOptions = {}
): UseQueryResult<RemoveLiquidityPreviewResult | null> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['liquidity-preview', 'remove', marketAddress, lpAmount?.toString(), network],
    queryFn: async (): Promise<RemoveLiquidityPreviewResult | null> => {
      // These conditions are enforced by the `enabled` flag, but TypeScript needs the assertion
      if (!marketAddress || lpAmount === undefined) {
        throw new Error('Market address and LP amount are required');
      }

      const routerStatic = getRouterStaticContract(provider, network);

      // RouterStatic not deployed on this network
      if (!routerStatic) {
        return null;
      }

      const rawOutput = await routerStatic.preview_remove_liquidity_single_sy(
        marketAddress,
        lpAmount
      );
      const expectedSyOut = toBigInt(rawOutput);

      return {
        expectedSyOut,
        lpAmount,
      };
    },
    enabled: enabled && !!marketAddress && lpAmount !== undefined && lpAmount > 0n,
    refetchInterval,
    staleTime: 15000, // Consider data stale after 15 seconds - market state changes
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}

/**
 * Combined hook to preview liquidity operations.
 *
 * This is a convenience hook that can preview either add or remove operations
 * based on the direction parameter.
 *
 * @param marketAddress - The market contract address
 * @param amount - Input amount (SY for add, LP for remove)
 * @param direction - 'add' for adding liquidity, 'remove' for removing
 * @param options - Query options
 * @returns Query result with expected output
 */
export function useLiquidityPreview(
  marketAddress: string | undefined,
  amount: bigint | undefined,
  direction: LiquidityPreviewDirection,
  options: UseLiquidityPreviewOptions = {}
): UseQueryResult<AddLiquidityPreviewResult | RemoveLiquidityPreviewResult | null> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['liquidity-preview', direction, marketAddress, amount?.toString(), network],
    queryFn: async (): Promise<AddLiquidityPreviewResult | RemoveLiquidityPreviewResult | null> => {
      // These conditions are enforced by the `enabled` flag, but TypeScript needs the assertion
      if (!marketAddress || amount === undefined) {
        throw new Error('Market address and amount are required');
      }

      const routerStatic = getRouterStaticContract(provider, network);

      // RouterStatic not deployed on this network
      if (!routerStatic) {
        return null;
      }

      if (direction === 'add') {
        const rawOutput = await routerStatic.preview_add_liquidity_single_sy(marketAddress, amount);
        const expectedLpOut = toBigInt(rawOutput);

        return {
          expectedLpOut,
          syAmount: amount,
        } as AddLiquidityPreviewResult;
      } else {
        const rawOutput = await routerStatic.preview_remove_liquidity_single_sy(
          marketAddress,
          amount
        );
        const expectedSyOut = toBigInt(rawOutput);

        return {
          expectedSyOut,
          lpAmount: amount,
        } as RemoveLiquidityPreviewResult;
      }
    },
    enabled: enabled && !!marketAddress && amount !== undefined && amount > 0n,
    refetchInterval,
    staleTime: 15000, // Consider data stale after 15 seconds - market state changes
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}
