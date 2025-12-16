/**
 * Transaction Builder Utility
 *
 * Provides reusable functions for building multicall transactions
 * for the simplified UI mode. These functions handle the complex
 * multi-step DeFi operations and combine them into single transactions.
 */

import { type Call, uint256 } from 'starknet';

/**
 * Parameters for building deposit and earn calls
 */
export interface DepositAndEarnParams {
  userAddress: string;
  underlyingAddress: string;
  syAddress: string;
  ytAddress: string;
  routerAddress: string;
  amount: bigint;
  underlyingAllowance: bigint | undefined;
  syAllowance: bigint | undefined;
  slippageBps?: number; // Default: 50 (0.5%)
}

/**
 * Parameters for building withdraw calls
 */
export interface WithdrawParams {
  userAddress: string;
  underlyingAddress: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  routerAddress: string;
  amount: bigint;
  isExpired: boolean;
  ptAllowance: bigint | undefined;
  ytAllowance: bigint | undefined;
  slippageBps?: number; // Default: 50 (0.5%)
}

/**
 * Check if approval is needed for a given amount
 */
export function needsApproval(allowance: bigint | undefined, amount: bigint): boolean {
  if (allowance === undefined) return true;
  return allowance < amount;
}

/**
 * Calculate minimum output with slippage protection
 * @param amount - Input amount
 * @param slippageBps - Slippage in basis points (e.g., 50 = 0.5%). Must be 0-9999.
 */
export function calculateMinOutput(amount: bigint, slippageBps = 50): bigint {
  if (slippageBps < 0 || slippageBps >= 10000) {
    throw new Error(`Invalid slippageBps: ${String(slippageBps)}. Must be between 0 and 9999.`);
  }
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (amount * slippageMultiplier) / BigInt(10000);
}

/**
 * Build an ERC20 approval call
 */
export function buildApprovalCall(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint
): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: tokenAddress,
    entrypoint: 'approve',
    calldata: [spenderAddress, u256Amount.low, u256Amount.high],
  };
}

/**
 * Build a deposit (wrap) call to SY contract
 * SY.deposit(receiver, amount) -> amount_sy_minted
 */
export function buildDepositToSyCall(syAddress: string, receiver: string, amount: bigint): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: syAddress,
    entrypoint: 'deposit',
    calldata: [receiver, u256Amount.low, u256Amount.high],
  };
}

/**
 * Build a mint PT+YT call via router
 * Router.mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out)
 */
export function buildMintPyCall(
  routerAddress: string,
  ytAddress: string,
  receiver: string,
  amountSy: bigint,
  minPyOut: bigint
): Call {
  const u256AmountSy = uint256.bnToUint256(amountSy);
  const u256MinPy = uint256.bnToUint256(minPyOut);
  return {
    contractAddress: routerAddress,
    entrypoint: 'mint_py_from_sy',
    calldata: [
      ytAddress,
      receiver,
      u256AmountSy.low,
      u256AmountSy.high,
      u256MinPy.low,
      u256MinPy.high,
    ],
  };
}

/**
 * Build a redeem PT+YT to SY call (pre-expiry)
 * Router.redeem_py_to_sy(yt, receiver, amount_py_in, min_sy_out)
 */
export function buildRedeemPyToSyCall(
  routerAddress: string,
  ytAddress: string,
  receiver: string,
  amount: bigint,
  minSyOut: bigint
): Call {
  const u256Amount = uint256.bnToUint256(amount);
  const u256MinSy = uint256.bnToUint256(minSyOut);
  return {
    contractAddress: routerAddress,
    entrypoint: 'redeem_py_to_sy',
    calldata: [ytAddress, receiver, u256Amount.low, u256Amount.high, u256MinSy.low, u256MinSy.high],
  };
}

/**
 * Build a redeem PT post-expiry call
 * Router.redeem_pt_post_expiry(yt, receiver, amount_pt_in, min_sy_out)
 */
export function buildRedeemPtPostExpiryCall(
  routerAddress: string,
  ytAddress: string,
  receiver: string,
  amount: bigint,
  minSyOut: bigint
): Call {
  const u256Amount = uint256.bnToUint256(amount);
  const u256MinSy = uint256.bnToUint256(minSyOut);
  return {
    contractAddress: routerAddress,
    entrypoint: 'redeem_pt_post_expiry',
    calldata: [ytAddress, receiver, u256Amount.low, u256Amount.high, u256MinSy.low, u256MinSy.high],
  };
}

/**
 * Build an unwrap (redeem) call from SY contract
 * SY.redeem(receiver, amount_sy_to_redeem) -> amount_redeemed
 */
export function buildUnwrapSyCall(syAddress: string, receiver: string, amount: bigint): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: syAddress,
    entrypoint: 'redeem',
    calldata: [receiver, u256Amount.low, u256Amount.high],
  };
}

/**
 * Build complete deposit and earn multicall
 *
 * Combines:
 * 1. Approve underlying → SY (if needed)
 * 2. Deposit underlying → SY (wrap)
 * 3. Approve SY → Router (if needed)
 * 4. Mint PT + YT from SY
 */
export function buildDepositAndEarnCalls(params: DepositAndEarnParams): Call[] {
  const {
    userAddress,
    underlyingAddress,
    syAddress,
    ytAddress,
    routerAddress,
    amount,
    underlyingAllowance,
    syAllowance,
    slippageBps = 50,
  } = params;

  const calls: Call[] = [];
  const minPyOut = calculateMinOutput(amount, slippageBps);

  // Step 1: Approve underlying → SY (if needed)
  if (needsApproval(underlyingAllowance, amount)) {
    calls.push(buildApprovalCall(underlyingAddress, syAddress, amount));
  }

  // Step 2: Wrap underlying → SY
  calls.push(buildDepositToSyCall(syAddress, userAddress, amount));

  // Step 3: Approve SY → Router (if needed)
  // After wrap, we'll have ~amount of SY (1:1 ratio)
  if (needsApproval(syAllowance, amount)) {
    calls.push(buildApprovalCall(syAddress, routerAddress, amount));
  }

  // Step 4: Mint PT + YT from SY
  calls.push(buildMintPyCall(routerAddress, ytAddress, userAddress, amount, minPyOut));

  return calls;
}

/**
 * Build complete withdraw multicall
 *
 * Pre-expiry combines:
 * 1. Approve PT → Router (if needed)
 * 2. Approve YT → Router (if needed)
 * 3. Redeem PT + YT → SY
 * 4. Unwrap SY → underlying
 *
 * Post-expiry combines:
 * 1. Approve PT → Router (if needed)
 * 2. Redeem PT → SY
 * 3. Unwrap SY → underlying
 */
export function buildWithdrawCalls(params: WithdrawParams): Call[] {
  const {
    userAddress,
    syAddress,
    ptAddress,
    ytAddress,
    routerAddress,
    amount,
    isExpired,
    ptAllowance,
    ytAllowance,
    slippageBps = 50,
  } = params;

  const calls: Call[] = [];
  const minSyOut = calculateMinOutput(amount, slippageBps);

  if (isExpired) {
    // Post-expiry flow: PT only

    // Step 1: Approve PT → Router (if needed)
    if (needsApproval(ptAllowance, amount)) {
      calls.push(buildApprovalCall(ptAddress, routerAddress, amount));
    }

    // Step 2: Redeem PT post expiry → SY
    calls.push(
      buildRedeemPtPostExpiryCall(routerAddress, ytAddress, userAddress, amount, minSyOut)
    );
  } else {
    // Pre-expiry flow: PT + YT

    // Step 1: Approve PT → Router (if needed)
    if (needsApproval(ptAllowance, amount)) {
      calls.push(buildApprovalCall(ptAddress, routerAddress, amount));
    }

    // Step 2: Approve YT → Router (if needed)
    if (needsApproval(ytAllowance, amount)) {
      calls.push(buildApprovalCall(ytAddress, routerAddress, amount));
    }

    // Step 3: Redeem PT + YT → SY
    calls.push(buildRedeemPyToSyCall(routerAddress, ytAddress, userAddress, amount, minSyOut));
  }

  // Final step: Unwrap SY → underlying
  calls.push(buildUnwrapSyCall(syAddress, userAddress, minSyOut));

  return calls;
}

/**
 * Estimate the number of calls in a deposit transaction
 * Useful for UI feedback
 */
export function estimateDepositCallCount(
  underlyingAllowance: bigint | undefined,
  syAllowance: bigint | undefined,
  amount: bigint
): number {
  let count = 2; // deposit + mint are always required
  if (needsApproval(underlyingAllowance, amount)) count++;
  if (needsApproval(syAllowance, amount)) count++;
  return count;
}

/**
 * Estimate the number of calls in a withdraw transaction
 * Useful for UI feedback
 */
export function estimateWithdrawCallCount(
  isExpired: boolean,
  ptAllowance: bigint | undefined,
  ytAllowance: bigint | undefined,
  amount: bigint
): number {
  let count = 2; // redeem + unwrap are always required
  if (needsApproval(ptAllowance, amount)) count++;
  if (!isExpired && needsApproval(ytAllowance, amount)) count++;
  return count;
}
