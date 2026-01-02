'use client';

import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

export interface SyTokenValidationResult {
  /** Whether the token is valid for deposit (wrapping) */
  isValidTokenIn: boolean;
  /** Whether the token is valid for redeem (unwrapping) */
  isValidTokenOut: boolean;
}

/**
 * Hook to validate if a token is supported for deposit/redeem operations.
 *
 * Uses on-chain `is_valid_token_in` and `is_valid_token_out` functions
 * to check token compatibility before executing transactions.
 *
 * @param syAddress - The SY contract address
 * @param tokenAddress - The token address to validate
 * @returns Query result with validation status for both directions
 *
 * @example
 * ```typescript
 * const { data: validation } = useSyTokenValidation(syAddress, tokenAddress);
 *
 * if (validation?.isValidTokenIn) {
 *   // Token can be deposited (wrapped) into SY
 * }
 *
 * if (validation?.isValidTokenOut) {
 *   // Token can be redeemed (unwrapped) from SY
 * }
 * ```
 */
export function useSyTokenValidation(
  syAddress: string | undefined,
  tokenAddress: string | undefined
): UseQueryResult<SyTokenValidationResult | null> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'token-validation', syAddress, tokenAddress],
    queryFn: async (): Promise<SyTokenValidationResult | null> => {
      if (syAddress === undefined || tokenAddress === undefined) {
        return null;
      }

      const sy = getSYContract(syAddress, provider);

      const [validIn, validOut] = await Promise.all([
        sy.is_valid_token_in(tokenAddress),
        sy.is_valid_token_out(tokenAddress),
      ]);

      return {
        isValidTokenIn: validIn,
        isValidTokenOut: validOut,
      };
    },
    enabled: syAddress !== undefined && tokenAddress !== undefined,
    staleTime: 300_000, // 5 minutes - token lists don't change often
  });
}

/**
 * Hook to check if a token can be deposited (wrapped) into SY.
 * Convenience wrapper for deposit-only validation.
 *
 * @param syAddress - The SY contract address
 * @param tokenAddress - The token address to check
 * @returns Whether the token is valid for deposit
 */
export function useIsValidTokenIn(
  syAddress: string | undefined,
  tokenAddress: string | undefined
): boolean {
  const { data } = useSyTokenValidation(syAddress, tokenAddress);
  return data?.isValidTokenIn ?? false;
}

/**
 * Hook to check if a token can be redeemed (unwrapped) from SY.
 * Convenience wrapper for redeem-only validation.
 *
 * @param syAddress - The SY contract address
 * @param tokenAddress - The token address to check
 * @returns Whether the token is valid for redeem
 */
export function useIsValidTokenOut(
  syAddress: string | undefined,
  tokenAddress: string | undefined
): boolean {
  const { data } = useSyTokenValidation(syAddress, tokenAddress);
  return data?.isValidTokenOut ?? false;
}
