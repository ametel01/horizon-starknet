'use client';

import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

export type SyPreviewDirection = 'deposit' | 'redeem';

export interface SyPreviewResult {
  /** Expected output amount from the preview */
  expectedOutput: bigint;
  /** The input amount used for preview */
  inputAmount: bigint;
  /** Direction of the preview (deposit or redeem) */
  direction: SyPreviewDirection;
}

/**
 * Convert various numeric return types to bigint.
 * Handles: bigint, number, Uint256 struct
 */
function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  // Handle Uint256 struct with BigNumberish properties
  if (value !== null && typeof value === 'object' && 'low' in value && 'high' in value) {
    return uint256.uint256ToBN(value as { low: bigint; high: bigint });
  }
  // Fallback for string representation
  if (typeof value === 'string') {
    return BigInt(value);
  }
  return 0n;
}

/**
 * Hook to preview deposit/redeem outputs for accurate slippage calculation.
 *
 * Uses on-chain `preview_deposit` and `preview_redeem` functions to get
 * accurate expected output amounts, which can be used to calculate
 * precise slippage-protected minimum outputs.
 *
 * @param syAddress - The SY contract address
 * @param amount - The input amount to preview (underlying for deposit, SY for redeem)
 * @param direction - 'deposit' to preview wrapping, 'redeem' to preview unwrapping
 * @returns Query result with expected output amount
 *
 * @example
 * ```typescript
 * const { data: preview } = useSyPreview(syAddress, underlyingAmount, 'deposit');
 *
 * if (preview) {
 *   // Calculate min output with 0.5% slippage
 *   const minSharesOut = (preview.expectedOutput * 995n) / 1000n;
 * }
 * ```
 */
export function useSyPreview(
  syAddress: string | undefined,
  amount: bigint | undefined,
  direction: SyPreviewDirection
): UseQueryResult<SyPreviewResult> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'preview', syAddress, direction, amount?.toString()],
    queryFn: async (): Promise<SyPreviewResult> => {
      if (syAddress === undefined || amount === undefined || amount === 0n) {
        return {
          expectedOutput: 0n,
          inputAmount: 0n,
          direction,
        };
      }

      const sy = getSYContract(syAddress, provider);

      const rawOutput =
        direction === 'deposit'
          ? await sy.preview_deposit(amount)
          : await sy.preview_redeem(amount);

      const expectedOutput = toBigInt(rawOutput);

      return {
        expectedOutput,
        inputAmount: amount,
        direction,
      };
    },
    enabled: syAddress !== undefined && amount !== undefined && amount > 0n,
    staleTime: 30_000, // 30 seconds - exchange rates change slowly
    refetchInterval: 60_000, // Refetch every minute for fresh rates
  });
}

/**
 * Hook to preview deposit (wrap underlying -> SY).
 * Convenience wrapper around useSyPreview for deposit operations.
 *
 * @param syAddress - The SY contract address
 * @param underlyingAmount - Amount of underlying to deposit
 * @returns Expected SY shares output
 */
export function useSyDepositPreview(
  syAddress: string | undefined,
  underlyingAmount: bigint | undefined
): UseQueryResult<SyPreviewResult> {
  return useSyPreview(syAddress, underlyingAmount, 'deposit');
}

/**
 * Hook to preview redeem (SY -> underlying).
 * Convenience wrapper around useSyPreview for redeem operations.
 *
 * @param syAddress - The SY contract address
 * @param syAmount - Amount of SY to redeem
 * @returns Expected underlying output
 */
export function useSyRedeemPreview(
  syAddress: string | undefined,
  syAmount: bigint | undefined
): UseQueryResult<SyPreviewResult> {
  return useSyPreview(syAddress, syAmount, 'redeem');
}

/**
 * Calculate minimum output with slippage protection.
 *
 * @param expectedOutput - The expected output from preview
 * @param slippageBps - Slippage tolerance in basis points (100 = 1%)
 * @returns Minimum acceptable output
 *
 * @example
 * ```typescript
 * const minOut = calculateMinOutputWithSlippage(preview.expectedOutput, 50); // 0.5% slippage
 * ```
 */
export function calculateMinOutputWithSlippage(
  expectedOutput: bigint,
  slippageBps: number
): bigint {
  if (expectedOutput === 0n || slippageBps < 0) {
    return 0n;
  }

  // min = expected * (10000 - slippageBps) / 10000
  const slippageFactor = 10000n - BigInt(Math.floor(slippageBps));
  return (expectedOutput * slippageFactor) / 10000n;
}
