'use client';

import { useStarknet } from '@features/wallet';
import { getRouterStaticContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

/**
 * Direction of the swap preview
 */
export type SwapPreviewDirection = 'sy_for_pt' | 'pt_for_sy';

/**
 * Result of a swap preview
 */
export interface SwapPreviewResult {
  /** Expected output amount from the preview */
  expectedOutput: bigint;
  /** The input amount used for preview */
  inputAmount: bigint;
  /** Direction of the swap */
  direction: SwapPreviewDirection;
}

interface UseSwapPreviewOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
}

/**
 * Hook to preview swap outputs using RouterStatic.
 *
 * Uses on-chain `preview_swap_exact_sy_for_pt` and `preview_swap_exact_pt_for_sy`
 * functions from RouterStatic to get expected output amounts for accurate
 * slippage calculation.
 *
 * @param marketAddress - The market contract address
 * @param amount - The input amount to preview (SY or PT depending on direction)
 * @param direction - 'sy_for_pt' to swap SY for PT, 'pt_for_sy' to swap PT for SY
 * @param options - Query options
 * @returns Query result with expected output amount, or null if RouterStatic unavailable
 *
 * @example
 * ```typescript
 * const { data: preview } = useSwapPreview(marketAddress, syAmount, 'sy_for_pt');
 *
 * if (preview) {
 *   // Calculate min output with 0.5% slippage
 *   const minPtOut = (preview.expectedOutput * 995n) / 1000n;
 * }
 * ```
 *
 * @see i_router_static.cairo lines 62-64 (preview_swap_exact_sy_for_pt)
 * @see i_router_static.cairo lines 70-72 (preview_swap_exact_pt_for_sy)
 */
export function useSwapPreview(
  marketAddress: string | undefined,
  amount: bigint | undefined,
  direction: SwapPreviewDirection,
  options: UseSwapPreviewOptions = {}
): UseQueryResult<SwapPreviewResult | null> {
  const { provider, network } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['swap-preview', marketAddress, direction, amount?.toString(), network],
    queryFn: async (): Promise<SwapPreviewResult | null> => {
      // These conditions are enforced by the `enabled` flag, but TypeScript needs the assertion
      if (!marketAddress || amount === undefined) {
        throw new Error('Market address and amount are required');
      }

      const routerStatic = getRouterStaticContract(provider, network);

      // RouterStatic not deployed on this network
      if (!routerStatic) {
        return null;
      }

      const rawOutput =
        direction === 'sy_for_pt'
          ? await routerStatic.preview_swap_exact_sy_for_pt(marketAddress, amount)
          : await routerStatic.preview_swap_exact_pt_for_sy(marketAddress, amount);

      const expectedOutput = toBigInt(rawOutput as bigint | { low: bigint; high: bigint });

      return {
        expectedOutput,
        inputAmount: amount,
        direction,
      };
    },
    enabled: enabled && !!marketAddress && amount !== undefined && amount > 0n,
    refetchInterval,
    staleTime: 15000, // Consider data stale after 15 seconds - market state changes
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}

/**
 * Hook to preview swapping SY for PT.
 * Convenience wrapper around useSwapPreview for SY -> PT swaps.
 *
 * @param marketAddress - The market contract address
 * @param syAmount - Amount of SY to swap
 * @param options - Query options
 * @returns Expected PT output
 */
export function useSwapSyForPtPreview(
  marketAddress: string | undefined,
  syAmount: bigint | undefined,
  options: UseSwapPreviewOptions = {}
): UseQueryResult<SwapPreviewResult | null> {
  return useSwapPreview(marketAddress, syAmount, 'sy_for_pt', options);
}

/**
 * Hook to preview swapping PT for SY.
 * Convenience wrapper around useSwapPreview for PT -> SY swaps.
 *
 * @param marketAddress - The market contract address
 * @param ptAmount - Amount of PT to swap
 * @param options - Query options
 * @returns Expected SY output
 */
export function useSwapPtForSyPreview(
  marketAddress: string | undefined,
  ptAmount: bigint | undefined,
  options: UseSwapPreviewOptions = {}
): UseQueryResult<SwapPreviewResult | null> {
  return useSwapPreview(marketAddress, ptAmount, 'pt_for_sy', options);
}
