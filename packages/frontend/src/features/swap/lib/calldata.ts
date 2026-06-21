/**
 * Calldata serialization utilities for Starknet contract calls.
 *
 * Handles serialization of complex types (TokenInput, TokenOutput, SwapData, ApproxParams)
 * to flat felt252 array format expected by Starknet.
 *
 * @see i_router.cairo for Cairo struct definitions
 */

import type { SwapData, TokenInput, TokenOutput } from '../model/types';

// ============================================================================
// U256 Serialization
// ============================================================================

/**
 * Serialize a bigint to u256 calldata format [low, high].
 *
 * Starknet u256 is represented as two u128 values:
 * - low: lower 128 bits
 * - high: upper 128 bits
 *
 * @param value - The bigint value to serialize
 * @returns Tuple of [low, high] as hex strings
 */
export function serializeU256(value: bigint): [string, string] {
  if (value < 0n) {
    throw new Error(`serializeU256: value must be non-negative, got ${value}`);
  }
  const maxU256 = (1n << 256n) - 1n;
  if (value > maxU256) {
    throw new Error(`serializeU256: value exceeds u256 max, got ${value}`);
  }
  const mask128 = (1n << 128n) - 1n;
  const low = value & mask128;
  const high = value >> 128n;
  return [`0x${low.toString(16)}`, `0x${high.toString(16)}`];
}

// ============================================================================
// Span<felt252> Serialization
// ============================================================================

/**
 * Serialize an array to Span<felt252> calldata format.
 *
 * Cairo Span serialization:
 * - First element: array length
 * - Remaining elements: array contents
 *
 * @param items - Array of felt252 values (as strings)
 * @returns Array with length prefix followed by items
 */
function serializeSpan(items: string[]): string[] {
  return [items.length.toString(), ...items];
}

// ============================================================================
// SwapData Serialization
// ============================================================================

/**
 * Serialize SwapData struct to calldata format.
 *
 * Cairo struct layout:
 * ```cairo
 * struct SwapData {
 *     aggregator: ContractAddress,
 *     calldata: Span<felt252>,
 * }
 * ```
 *
 * @param swapData - The SwapData to serialize
 * @returns Flat array of felt252 values
 */
function serializeSwapData(swapData: SwapData): string[] {
  return [
    swapData.aggregator, // ContractAddress
    ...serializeSpan(swapData.calldata), // Span<felt252>: [length, ...items]
  ];
}

// ============================================================================
// TokenInput Serialization
// ============================================================================

/**
 * Serialize TokenInput struct to calldata format.
 *
 * Cairo struct layout:
 * ```cairo
 * struct TokenInput {
 *     token: ContractAddress,
 *     amount: u256,
 *     swap_data: SwapData,
 * }
 * ```
 *
 * @param input - The TokenInput to serialize
 * @returns Flat array of felt252 values
 */
export function serializeTokenInput(input: TokenInput): string[] {
  const [amountLow, amountHigh] = serializeU256(input.amount);
  return [
    input.token, // ContractAddress
    amountLow, // u256.low
    amountHigh, // u256.high
    ...serializeSwapData(input.swap_data), // SwapData
  ];
}

// ============================================================================
// TokenOutput Serialization
// ============================================================================

/**
 * Serialize TokenOutput struct to calldata format.
 *
 * Cairo struct layout:
 * ```cairo
 * struct TokenOutput {
 *     token: ContractAddress,
 *     min_amount: u256,
 *     swap_data: SwapData,
 * }
 * ```
 *
 * @param output - The TokenOutput to serialize
 * @returns Flat array of felt252 values
 */
export function serializeTokenOutput(output: TokenOutput): string[] {
  const [minAmountLow, minAmountHigh] = serializeU256(output.min_amount);
  return [
    output.token, // ContractAddress
    minAmountLow, // u256.low
    minAmountHigh, // u256.high
    ...serializeSwapData(output.swap_data), // SwapData
  ];
}

// ============================================================================
// ApproxParams Serialization
// ============================================================================
