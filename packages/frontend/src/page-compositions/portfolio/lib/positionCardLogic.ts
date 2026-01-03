/**
 * Pure helper functions for PositionCard complexity reduction.
 * Extracted following FSD principles - business-logic-free utilities.
 */

/**
 * Token symbol labels derived from market metadata.
 * Centralizes the naming convention for PT, YT, SY tokens.
 */
export interface TokenSymbols {
  tokenSymbol: string;
  tokenName: string;
  sySymbol: string;
  ptSymbol: string;
  ytSymbol: string;
}

export function deriveTokenSymbols(
  metadata:
    | {
        yieldTokenSymbol?: string;
        yieldTokenName?: string;
      }
    | undefined
): TokenSymbols {
  const tokenSymbol = metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = metadata?.yieldTokenName ?? 'Unknown Market';

  return {
    tokenSymbol,
    tokenName,
    sySymbol: `SY-${tokenSymbol}`,
    ptSymbol: `PT-${tokenSymbol}`,
    ytSymbol: `YT-${tokenSymbol}`,
  };
}

/**
 * Transaction status derived from async state flags.
 * Replaces repetitive useMemo patterns.
 */
export type TxStatusValue = 'idle' | 'pending' | 'success' | 'error';

export function deriveTxStatus(
  isPending: boolean,
  isSuccess: boolean,
  isError: boolean
): TxStatusValue {
  if (isPending) return 'pending';
  if (isSuccess) return 'success';
  if (isError) return 'error';
  return 'idle';
}

/**
 * Check if position has any non-zero balance.
 */
export function hasAnyBalance(position: {
  syBalance: bigint;
  ptBalance: bigint;
  ytBalance: bigint;
  lpBalance: bigint;
}): boolean {
  return (
    position.syBalance > 0n ||
    position.ptBalance > 0n ||
    position.ytBalance > 0n ||
    position.lpBalance > 0n
  );
}

/**
 * Calculate the redeemable amount for PT+YT redemption.
 * Returns the minimum of PT and YT balances.
 */
export function calculateRedeemableAmount(ptBalance: bigint, ytBalance: bigint): bigint {
  return ptBalance < ytBalance ? ptBalance : ytBalance;
}
