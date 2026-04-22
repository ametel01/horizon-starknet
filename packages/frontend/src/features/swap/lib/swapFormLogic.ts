/**
 * Pure logic extracted from SwapForm to reduce cognitive complexity.
 *
 * This module contains:
 * - Direction derivation (lookup table)
 * - Swap quote calculation
 * - Call building for gas estimation
 * - Button state derivation
 */

import { getDeadline } from '@shared/lib/deadline';
import {
  type MarketState as AmmMarketState,
  calcSwapExactPtForSy,
  calcSwapExactSyForPt,
  calcSwapSyForExactPt,
  type SwapResult,
} from '@shared/math/amm';
import { WAD_BIGINT } from '@shared/math/wad';
import type { Call } from 'starknet';
import type { SwapDirection } from '../model/useSwap';

// ============================================================================
// Types
// ============================================================================

export type TokenType = 'PT' | 'YT';

// ============================================================================
// Token Type Change Toast Messages
// ============================================================================

const TOKEN_TYPE_DESCRIPTIONS: Record<TokenType, string> = {
  PT: 'Principal Token – fixed yield at maturity',
  YT: 'Yield Token – leveraged yield exposure',
};

export function getTokenTypeDescription(tokenType: TokenType): string {
  return TOKEN_TYPE_DESCRIPTIONS[tokenType];
}

/**
 * Type guard to check if a string is a valid TokenType.
 */
export function isValidTokenType(value: string): value is TokenType {
  return value === 'PT' || value === 'YT';
}

/**
 * Type guard to check if a string is a valid buy/sell direction.
 */
export function isValidBuySell(value: string): value is 'buy' | 'sell' {
  return value === 'buy' || value === 'sell';
}

export interface SwapFormMarket {
  address: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  expiry: number;
  isExpired: boolean;
}

export interface SwapFormState {
  isConnected: boolean;
  isValidAmount: boolean;
  hasInsufficientBalance: boolean;
  hasInsufficientCollateral: boolean;
  isSwapping: boolean;
  isSuccess: boolean;
  isExpired: boolean;
  priceImpactCanProceed: boolean;
  priceImpactRequiresAck: boolean;
  priceImpactAcknowledged: boolean;
}

export interface ButtonState {
  label: string;
  disabled: boolean;
}

// ============================================================================
// Direction Derivation (Lookup Table Pattern)
// ============================================================================

/**
 * Lookup table for swap direction based on tokenType and isBuying.
 * Replaces nested ternaries with O(1) lookup.
 */
const DIRECTION_MAP: Record<TokenType, Record<'buy' | 'sell', SwapDirection>> = {
  PT: { buy: 'buy_pt', sell: 'sell_pt' },
  YT: { buy: 'buy_yt', sell: 'sell_yt' },
};

export function deriveSwapDirection(tokenType: TokenType, isBuying: boolean): SwapDirection {
  return DIRECTION_MAP[tokenType][isBuying ? 'buy' : 'sell'];
}

// ============================================================================
// Swap Quote Calculation (Pure Function)
// ============================================================================

/**
 * Calculate swap quote for any direction.
 * Returns null if calculation fails or inputs are invalid.
 */
export function calculateSwapQuote(
  direction: SwapDirection,
  ammState: AmmMarketState,
  inputAmount: bigint
): SwapResult | null {
  if (inputAmount === 0n) return null;
  if (ammState.syReserve === 0n || ammState.ptReserve === 0n) return null;

  try {
    return calculateSwapQuoteUnsafe(direction, ammState, inputAmount);
  } catch {
    return null;
  }
}

/**
 * Internal: Calculate swap without error handling.
 * Separated to keep the try-catch scope minimal.
 */
function calculateSwapQuoteUnsafe(
  direction: SwapDirection,
  ammState: AmmMarketState,
  inputAmount: bigint
): SwapResult {
  switch (direction) {
    case 'buy_pt':
      return calcSwapExactSyForPt(ammState, inputAmount);

    case 'sell_pt':
      return calcSwapExactPtForSy(ammState, inputAmount);

    case 'buy_yt':
      return calculateBuyYtQuote(ammState, inputAmount);

    case 'sell_yt':
      return calculateSellYtQuote(ammState, inputAmount);
  }
}

/**
 * YT buying involves minting PT+YT and selling PT.
 */
function calculateBuyYtQuote(ammState: AmmMarketState, inputAmount: bigint): SwapResult {
  const ptSaleResult = calcSwapExactPtForSy(ammState, inputAmount);
  return {
    amountOut: inputAmount,
    fee: ptSaleResult.fee,
    newLnImpliedRate: ptSaleResult.newLnImpliedRate,
    priceImpact: ptSaleResult.priceImpact,
    effectivePrice:
      inputAmount > 0n
        ? ((inputAmount - ptSaleResult.amountOut) * WAD_BIGINT) / inputAmount
        : WAD_BIGINT,
    spotPrice: WAD_BIGINT - ptSaleResult.spotPrice,
  };
}

/**
 * YT selling requires buying PT to pair with YT for redemption.
 */
function calculateSellYtQuote(ammState: AmmMarketState, inputAmount: bigint): SwapResult {
  const ptNeeded = inputAmount;
  const ptPurchaseResult = calcSwapSyForExactPt(ammState, ptNeeded);
  const syNeededForPt = ptPurchaseResult.amountOut;
  const syOut = ptNeeded > syNeededForPt ? ptNeeded - syNeededForPt : 0n;

  return {
    amountOut: syOut,
    fee: ptPurchaseResult.fee,
    newLnImpliedRate: ptPurchaseResult.newLnImpliedRate,
    priceImpact: ptPurchaseResult.priceImpact,
    effectivePrice: syOut > 0n ? (syNeededForPt * WAD_BIGINT) / syOut : WAD_BIGINT,
    spotPrice: WAD_BIGINT - ptPurchaseResult.spotPrice,
  };
}

// ============================================================================
// Call Building (Pure Function)
// ============================================================================

interface CallBuildingParams {
  direction: SwapDirection;
  market: SwapFormMarket;
  routerAddress: string;
  userAddress: string;
  inputAmount: bigint;
  minOutput: bigint;
}

/**
 * Build transaction calls for a swap operation.
 * Returns null if user is not connected or amount is zero.
 */
export function buildSwapCalls(params: CallBuildingParams): Call[] | null {
  const { direction, market, routerAddress, userAddress, inputAmount, minOutput } = params;

  if (!userAddress || inputAmount === 0n) return null;

  const deadline = getDeadline();

  switch (direction) {
    case 'buy_pt':
      return buildBuyPtCalls(market, routerAddress, userAddress, inputAmount, minOutput, deadline);

    case 'sell_pt':
      return buildSellPtCalls(market, routerAddress, userAddress, inputAmount, minOutput, deadline);

    case 'buy_yt':
      return buildBuyYtCalls(market, routerAddress, userAddress, inputAmount, minOutput, deadline);

    case 'sell_yt':
      return buildSellYtCalls(market, routerAddress, userAddress, inputAmount, minOutput, deadline);
  }
}

// Helper: Convert bigint to uint256 calldata [low, high]
function toU256(value: bigint): [string, string] {
  const low = value & BigInt('0xffffffffffffffffffffffffffffffff');
  const high = value >> BigInt(128);
  return [low.toString(), high.toString()];
}

function buildBuyPtCalls(
  market: SwapFormMarket,
  routerAddress: string,
  userAddress: string,
  inputAmount: bigint,
  minOutput: bigint,
  deadline: bigint
): Call[] {
  const [amtLow, amtHigh] = toU256(inputAmount);
  const [minLow, minHigh] = toU256(minOutput);

  return [
    {
      contractAddress: market.syAddress,
      entrypoint: 'approve',
      calldata: [routerAddress, amtLow, amtHigh],
    },
    {
      contractAddress: routerAddress,
      entrypoint: 'swap_exact_sy_for_pt',
      calldata: [
        market.address,
        userAddress,
        amtLow,
        amtHigh,
        minLow,
        minHigh,
        deadline.toString(),
      ],
    },
  ];
}

function buildSellPtCalls(
  market: SwapFormMarket,
  routerAddress: string,
  userAddress: string,
  inputAmount: bigint,
  minOutput: bigint,
  deadline: bigint
): Call[] {
  const [amtLow, amtHigh] = toU256(inputAmount);
  const [minLow, minHigh] = toU256(minOutput);

  return [
    {
      contractAddress: market.ptAddress,
      entrypoint: 'approve',
      calldata: [routerAddress, amtLow, amtHigh],
    },
    {
      contractAddress: routerAddress,
      entrypoint: 'swap_exact_pt_for_sy',
      calldata: [
        market.address,
        userAddress,
        amtLow,
        amtHigh,
        minLow,
        minHigh,
        deadline.toString(),
      ],
    },
  ];
}

function buildBuyYtCalls(
  market: SwapFormMarket,
  routerAddress: string,
  userAddress: string,
  inputAmount: bigint,
  minOutput: bigint,
  deadline: bigint
): Call[] {
  const [amtLow, amtHigh] = toU256(inputAmount);
  const [minLow, minHigh] = toU256(minOutput);

  return [
    {
      contractAddress: market.syAddress,
      entrypoint: 'approve',
      calldata: [routerAddress, amtLow, amtHigh],
    },
    {
      contractAddress: routerAddress,
      entrypoint: 'swap_exact_sy_for_yt',
      calldata: [
        market.ytAddress,
        market.address,
        userAddress,
        amtLow,
        amtHigh,
        minLow,
        minHigh,
        deadline.toString(),
      ],
    },
  ];
}

function buildSellYtCalls(
  market: SwapFormMarket,
  routerAddress: string,
  userAddress: string,
  inputAmount: bigint,
  minOutput: bigint,
  deadline: bigint
): Call[] {
  const [amtLow, amtHigh] = toU256(inputAmount);
  const collateral = inputAmount * 4n;
  const [colLow, colHigh] = toU256(collateral);
  const [minLow, minHigh] = toU256(minOutput);

  return [
    {
      contractAddress: market.ytAddress,
      entrypoint: 'approve',
      calldata: [routerAddress, amtLow, amtHigh],
    },
    {
      contractAddress: market.syAddress,
      entrypoint: 'approve',
      calldata: [routerAddress, colLow, colHigh],
    },
    {
      contractAddress: routerAddress,
      entrypoint: 'swap_exact_yt_for_sy',
      calldata: [
        market.ytAddress,
        market.address,
        userAddress,
        amtLow,
        amtHigh,
        colLow,
        colHigh,
        minLow,
        minHigh,
        deadline.toString(),
      ],
    },
  ];
}

// ============================================================================
// Transaction Steps (Lookup Table)
// ============================================================================

interface TransactionStep {
  label: string;
  description: string;
}

const TRANSACTION_STEPS: Record<SwapDirection, TransactionStep[]> = {
  buy_pt: [
    { label: 'Approve SY', description: 'Approve token spending' },
    { label: 'Swap', description: 'Execute swap' },
  ],
  sell_pt: [
    { label: 'Approve PT', description: 'Approve token spending' },
    { label: 'Swap', description: 'Execute swap' },
  ],
  buy_yt: [
    { label: 'Approve SY', description: 'Approve token spending' },
    { label: 'Swap', description: 'Execute swap' },
  ],
  sell_yt: [
    { label: 'Approve YT', description: 'Approve YT tokens' },
    { label: 'Approve Collateral', description: 'Approve SY as collateral' },
    { label: 'Swap', description: 'Execute swap' },
  ],
};

export function getTransactionSteps(direction: SwapDirection): TransactionStep[] {
  return TRANSACTION_STEPS[direction];
}

// ============================================================================
// Button State Derivation (Guard Pattern + Lookup)
// ============================================================================

interface ButtonStateParams {
  state: SwapFormState;
  tokenType: TokenType;
  isBuying: boolean;
}

/**
 * Derive button label and disabled state.
 * Uses early-return guards instead of nested ternaries.
 */
export function deriveButtonState(params: ButtonStateParams): ButtonState {
  const { state, tokenType, isBuying } = params;

  // Guard: Currently swapping
  if (state.isSwapping) {
    return { label: 'Swapping...', disabled: true };
  }

  // Guard: Not connected
  if (!state.isConnected) {
    return { label: 'Connect Wallet', disabled: true };
  }

  // Guard: Market expired
  if (state.isExpired) {
    return { label: 'Market Expired', disabled: true };
  }

  // Guard: No amount entered
  if (!state.isValidAmount) {
    return { label: 'Enter Amount', disabled: true };
  }

  // Guard: Insufficient balance
  if (state.hasInsufficientBalance) {
    return { label: 'Insufficient Balance', disabled: true };
  }

  // Guard: Insufficient collateral (YT sell only)
  if (state.hasInsufficientCollateral) {
    return { label: 'Insufficient Collateral', disabled: true };
  }

  // Guard: Price impact requires acknowledgment
  if (state.priceImpactRequiresAck && !state.priceImpactAcknowledged) {
    return { label: 'Acknowledge Price Impact', disabled: true };
  }

  // Guard: Transaction success
  if (state.isSuccess) {
    return { label: 'Swapped!', disabled: true };
  }

  // Guard: Price impact too high
  if (!state.priceImpactCanProceed) {
    return { label: 'Price Impact Too High', disabled: true };
  }

  // Default: Ready to swap
  const action = isBuying ? 'Buy' : 'Sell';
  return { label: `${action} ${tokenType}`, disabled: false };
}

// ============================================================================
// Token Labels (Pure Derivation)
// ============================================================================

interface TokenLabels {
  sy: string;
  pt: string;
  yt: string;
  input: string;
  output: string;
}

export function deriveTokenLabels(
  tokenSymbol: string,
  tokenType: TokenType,
  isBuying: boolean
): TokenLabels {
  const sy = `SY-${tokenSymbol}`;
  const pt = `PT-${tokenSymbol}`;
  const yt = `YT-${tokenSymbol}`;

  const input = isBuying ? sy : tokenType === 'PT' ? pt : yt;
  const output = isBuying ? (tokenType === 'PT' ? pt : yt) : sy;

  return { sy, pt, yt, input, output };
}

/**
 * Get the input token address based on direction.
 */
export function getInputTokenAddress(
  market: SwapFormMarket,
  tokenType: TokenType,
  isBuying: boolean
): string {
  if (isBuying) return market.syAddress;
  return tokenType === 'PT' ? market.ptAddress : market.ytAddress;
}

// ============================================================================
// Output Badge Styling (Pre-computed View Model)
// ============================================================================

export interface OutputBadgeStyle {
  containerClass: string;
  textClass: string;
  displayText: string;
}

/**
 * Derive output badge styling based on direction and token type.
 * Pre-computes all conditional styles to keep JSX declarative.
 */
export function deriveOutputBadgeStyle(tokenType: TokenType, isBuying: boolean): OutputBadgeStyle {
  if (!isBuying) {
    return {
      containerClass: 'bg-chart-1/10',
      textClass: 'text-chart-1',
      displayText: 'SY',
    };
  }

  if (tokenType === 'PT') {
    return {
      containerClass: 'bg-primary/10',
      textClass: 'text-primary',
      displayText: 'PT',
    };
  }

  return {
    containerClass: 'bg-chart-2/10',
    textClass: 'text-chart-2',
    displayText: 'YT',
  };
}

// ============================================================================
// Implied APY View Model
// ============================================================================

export interface ImpliedApyDisplay {
  showSection: boolean;
  beforeFormatted: string;
  afterFormatted: string;
  changeClass: string;
}

/**
 * Derive implied APY display properties.
 */
export function deriveImpliedApyDisplay(
  direction: SwapDirection,
  impliedApyBefore: number,
  impliedApyAfter: number,
  isValidAmount: boolean
): ImpliedApyDisplay {
  const showSection = direction === 'buy_pt' || direction === 'sell_pt';
  const beforeFormatted = (impliedApyBefore * 100).toFixed(2);
  const afterFormatted = isValidAmount
    ? (impliedApyAfter * 100).toFixed(2)
    : (impliedApyBefore * 100).toFixed(2);

  let changeClass = 'text-muted-foreground';
  if (isValidAmount) {
    if (impliedApyAfter > impliedApyBefore) {
      changeClass = 'text-primary';
    } else if (impliedApyAfter < impliedApyBefore) {
      changeClass = 'text-destructive';
    }
  }

  return { showSection, beforeFormatted, afterFormatted, changeClass };
}

// ============================================================================
// Swap Rate Display
// ============================================================================

/**
 * Format the swap rate display.
 */
export function formatSwapRate(
  parsedInputAmount: bigint,
  expectedOutput: bigint,
  inputLabel: string,
  outputLabel: string
): string {
  if (parsedInputAmount <= 0n) {
    return `1 ${inputLabel} = - ${outputLabel}`;
  }

  // Use simple division for display (BigNumber handles large numbers)
  const rate = Number(expectedOutput) / Number(parsedInputAmount);
  return `1 ${inputLabel} = ${rate.toFixed(4)} ${outputLabel}`;
}

// ============================================================================
// UI State Derivation (Pre-computed View Models)
// ============================================================================

export interface SwapFormUiState {
  formGradient: 'primary' | 'destructive';
  inputError: string | undefined;
  flipButtonClass: string;
  showPriceImpactWarning: boolean;
  showYtCollateralWarning: boolean;
  sellButtonClass: string;
}

interface UiStateParams {
  isBuying: boolean;
  hasInsufficientBalance: boolean;
  isFlipping: boolean;
  isValidAmount: boolean;
  priceImpactSeverity: 'low' | 'medium' | 'high' | 'very-high' | 'extreme';
  direction: SwapDirection;
}

/**
 * Derive all UI state properties at once.
 * Centralizes conditional logic outside the component.
 */
export function deriveSwapFormUiState(params: UiStateParams): SwapFormUiState {
  const {
    isBuying,
    hasInsufficientBalance,
    isFlipping,
    isValidAmount,
    priceImpactSeverity,
    direction,
  } = params;

  return {
    formGradient: isBuying ? 'primary' : 'destructive',
    inputError: hasInsufficientBalance ? 'Insufficient balance' : undefined,
    flipButtonClass: isFlipping ? 'rotate-180' : '',
    showPriceImpactWarning: isValidAmount && priceImpactSeverity !== 'low',
    showYtCollateralWarning: direction === 'sell_yt' && isValidAmount,
    sellButtonClass: !isBuying
      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
      : '',
  };
}
