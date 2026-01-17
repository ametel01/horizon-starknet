/**
 * Token aggregation types matching Cairo structs from i_router.cairo
 * Field order matches Cairo Serde encoding for compatibility
 */

/**
 * Data for executing a swap through an external aggregator
 * @see i_router.cairo lines 7-10
 */
export interface SwapData {
  /** Address of the swap aggregator contract */
  aggregator: string;
  /** Encoded calldata to pass to the aggregator (array of felt252) */
  calldata: string[];
}

/**
 * Represents an input token to be swapped to SY via an aggregator
 * @see i_router.cairo lines 17-21
 */
export interface TokenInput {
  /** Address of the input ERC20 token */
  token: string;
  /** Amount of token to swap (u256 as bigint) */
  amount: bigint;
  /** Data for executing the swap (aggregator and calldata) */
  swap_data: SwapData;
}

/**
 * Represents an output token to receive after swapping from SY via an aggregator
 * @see i_router.cairo lines 28-32
 */
export interface TokenOutput {
  /** Address of the output ERC20 token */
  token: string;
  /** Minimum amount of token to receive (slippage protection, u256 as bigint) */
  min_amount: bigint;
  /** Data for executing the swap (aggregator and calldata) */
  swap_data: SwapData;
}

/**
 * Approximation parameters for binary search in swap/liquidity calculations
 * Matches Pendle's ApproxParams design for caller-provided search hints
 * @see i_router.cairo lines 53-59
 */
export interface ApproxParams {
  /** Lower bound for binary search (0n = use default) */
  guess_min: bigint;
  /** Upper bound for binary search (0n = use default) */
  guess_max: bigint;
  /** Off-chain computed guess for faster convergence (0n = no hint) */
  guess_offchain: bigint;
  /** Maximum binary search iterations (default: 20) */
  max_iteration: bigint;
  /** Precision threshold in WAD (1e15 = 0.1% precision) */
  eps: bigint;
}

/**
 * Default ApproxParams for typical operations
 * Uses conservative defaults that work for most cases
 */
export const DEFAULT_APPROX_PARAMS: ApproxParams = {
  guess_min: 0n,
  guess_max: 0n,
  guess_offchain: 0n,
  max_iteration: 20n,
  eps: 10n ** 15n, // 0.1% precision
};
