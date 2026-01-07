/**
 * Oracle readiness state for a market
 *
 * TWAP oracle can be in one of three states:
 * - ready: Full TWAP available at requested duration
 * - partial: Shorter TWAP available (market too new)
 * - spot-only: No TWAP history yet
 *
 * Note: `apy` is a decimal (e.g., 0.0824 for 8.24%), not percentage points.
 * Use `apy * 100` when displaying as percentage string.
 */
export type OracleStatus =
  | {
      state: 'ready';
      rate: bigint;
      duration: number;
      /** APY as decimal (e.g., 0.0824 = 8.24%) */
      apy: number;
    }
  | {
      state: 'partial';
      rate: bigint;
      availableDuration: number;
      requestedDuration: number;
      /** APY as decimal (e.g., 0.0824 = 8.24%) */
      apy: number;
    }
  | {
      state: 'spot-only';
      rate: bigint;
      /** APY as decimal (e.g., 0.0824 = 8.24%) */
      apy: number;
      estimatedReadyIn: string;
    };
