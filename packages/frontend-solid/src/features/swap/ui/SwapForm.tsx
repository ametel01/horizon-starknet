import { type Accessor, createEffect, createMemo, createSignal, on, type JSX, Show } from 'solid-js';

import { type MarketData } from '@/features/markets';
import { useAccount, useStarknet } from '@/features/wallet';
import { getAddresses, getMarketParams } from '@shared/config/addresses';
import { cn } from '@shared/lib/utils';
import { type MarketState as AmmMarketState, getImpliedApy } from '@shared/math/amm';
import { formatWad, fromWad, parseWad } from '@shared/math/wad';
import { createAnimatedNumber } from '@shared/ui/AnimatedNumber';
import { Button } from '@shared/ui/Button';
import {
  FormActions,
  FormDivider,
  FormInputSection,
  FormLayout,
  FormOutputSection,
  FormRow,
} from '@shared/ui/FormLayout';
import { NumberInput } from '@shared/ui/Input';
import { NearExpiryWarning } from '@shared/ui/NearExpiryWarning';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/ToggleGroup';
import { toast } from '@shared/ui/Toaster';

import {
  calculateSwapQuote,
  deriveButtonState,
  deriveOutputBadgeStyle,
  deriveSwapDirection,
  deriveSwapFormUiState,
  deriveTokenLabels,
  getInputTokenAddress,
  getTokenTypeDescription,
  isValidBuySell,
  isValidTokenType,
  type TokenType,
} from '../lib/swapFormLogic';
import { calculateMinOutput, type SwapDirection, useSwap } from '../model/useSwap';

export interface SwapFormProps {
  market: MarketData;
  class?: string;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

/**
 * Inline ArrowUpDown icon to avoid lucide-solid dependency
 */
function ArrowUpDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  );
}

/**
 * SwapForm - SolidJS port with reactive state management
 *
 * Features:
 * - Inline token type + direction toggles
 * - Visual direction indicator with animated swap button
 * - Price impact display
 * - Slippage settings
 * - Directional background gradient
 */
export function SwapForm(props: SwapFormProps): JSX.Element {
  const { isConnected, network } = useStarknet();
  const { address } = useAccount();
  const addresses = () => getAddresses(network);

  // Form state signals
  const [tokenType, setTokenType] = createSignal<TokenType>('PT');
  const [isBuying, setIsBuying] = createSignal(true);
  const [inputAmount, setInputAmount] = createSignal('');
  const [isFlipping, setIsFlipping] = createSignal(false);
  const [slippageBps, setSlippageBps] = createSignal(50); // 0.5% default

  // Derive swap direction from token type and buy/sell (lookup table)
  const direction = createMemo(() => deriveSwapDirection(tokenType(), isBuying()));

  const {
    swap,
    isSwapping,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetSwap,
  } = useSwap();

  // Derive token labels and addresses using pure functions
  const tokenSymbol = () => props.market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenLabels = createMemo(() => deriveTokenLabels(tokenSymbol(), tokenType(), isBuying()));
  const inputToken = createMemo(() => getInputTokenAddress(props.market, tokenType(), isBuying()));
  const inputLabel = () => tokenLabels().input;
  const outputLabel = () => tokenLabels().output;
  const syLabel = () => tokenLabels().sy;

  // Get market params for AMM calculations
  const marketParams = createMemo(() => getMarketParams(network));

  // Parse input amount and validate
  const parsedInputAmount = createMemo(() => {
    const amount = inputAmount();
    if (!amount || amount === '') return BigInt(0);
    try {
      return parseWad(amount);
    } catch {
      return BigInt(0);
    }
  });
  const isValidAmount = createMemo(() => parsedInputAmount() > 0n);

  // Build AMM market state for accurate calculations
  const ammState = createMemo((): AmmMarketState => ({
    syReserve: props.market.state.syReserve,
    ptReserve: props.market.state.ptReserve,
    totalLp: props.market.state.totalLpSupply,
    scalarRoot: marketParams().scalarRoot,
    initialAnchor: props.market.metadata?.initialAnchor ?? props.market.state.lnImpliedRate,
    feeRate: marketParams().feeRate,
    expiry: BigInt(props.market.expiry),
    lastLnImpliedRate: props.market.state.lnImpliedRate,
  }));

  // Calculate swap quote using extracted pure function
  const swapResult = createMemo(() =>
    calculateSwapQuote(direction(), ammState(), parsedInputAmount())
  );

  // Extract values from swap result
  const expectedOutput = createMemo(() => swapResult()?.amountOut ?? BigInt(0));
  const priceImpact = createMemo(() => swapResult()?.priceImpact ?? 0);

  // Animate output for Change Blindness prevention (UI/UX Law)
  const numericOutput = createMemo(() => fromWad(expectedOutput()).toNumber());
  const animatedOutput = createAnimatedNumber(numericOutput, { duration: 300, decimals: 6 });
  const formattedAnimatedOutput = createMemo(() => {
    const value = animatedOutput();
    if (value === 0) return '0.000000';
    const formatted = value.toFixed(6);
    const parts = formatted.split('.');
    const intPart = parts[0] ?? '0';
    const decPart = parts[1];
    if (decPart !== undefined) {
      const trimmed = decPart.replace(/0+$/, '').padEnd(2, '0');
      return `${intPart}.${trimmed}`;
    }
    return formatted;
  });

  // Price impact severity
  const priceImpactSeverity = createMemo((): 'low' | 'medium' | 'high' | 'very-high' | 'extreme' => {
    const impact = priceImpact();
    if (impact < 0.01) return 'low';
    if (impact < 0.03) return 'medium';
    if (impact < 0.05) return 'high';
    if (impact < 0.1) return 'very-high';
    return 'extreme';
  });

  // Calculate implied APY change and derive display properties
  const impliedApyBefore = createMemo(() => getImpliedApy(props.market.state.lnImpliedRate));
  const impliedApyAfter = createMemo(() => {
    const result = swapResult();
    return result ? getImpliedApy(result.newLnImpliedRate) : impliedApyBefore();
  });

  // Pre-compute view models to simplify JSX
  const outputBadgeStyle = createMemo(() => deriveOutputBadgeStyle(tokenType(), isBuying()));

  // Calculate minimum output with slippage
  const minOutput = createMemo(() => calculateMinOutput(expectedOutput(), slippageBps()));

  // Validation - placeholder for balance checks
  // In a full implementation, these would use useTokenBalance hooks
  const hasInsufficientBalance = createMemo(() => false);
  const hasInsufficientCollateral = createMemo(() => false);
  const collateralRequired = createMemo(() =>
    direction() === 'sell_yt' ? parsedInputAmount() * BigInt(4) : BigInt(0)
  );

  // Price impact warning state
  const priceImpactCanProceed = createMemo(() => priceImpactSeverity() !== 'extreme');
  const priceImpactRequiresAck = createMemo(() =>
    priceImpactSeverity() === 'high' || priceImpactSeverity() === 'very-high'
  );
  const [priceImpactAcknowledged, setPriceImpactAcknowledged] = createSignal(false);

  const canSwap = createMemo(
    () =>
      isConnected() &&
      isValidAmount() &&
      !hasInsufficientBalance() &&
      !hasInsufficientCollateral() &&
      !isSwapping() &&
      !isSuccess() &&
      !props.market.isExpired &&
      priceImpactCanProceed()
  );

  // Pre-computed UI state using extracted pure function
  const uiState = createMemo(() =>
    deriveSwapFormUiState({
      isBuying: isBuying(),
      hasInsufficientBalance: hasInsufficientBalance(),
      isFlipping: isFlipping(),
      isValidAmount: isValidAmount(),
      priceImpactSeverity: priceImpactSeverity(),
      direction: direction(),
    })
  );

  // Derive button state using guard pattern (replaces nested ternaries)
  const buttonState = createMemo(() =>
    deriveButtonState({
      state: {
        isConnected: isConnected(),
        isValidAmount: isValidAmount(),
        hasInsufficientBalance: hasInsufficientBalance(),
        hasInsufficientCollateral: hasInsufficientCollateral(),
        isSwapping: isSwapping(),
        isSuccess: isSuccess(),
        isExpired: props.market.isExpired,
        priceImpactCanProceed: priceImpactCanProceed(),
        priceImpactRequiresAck: priceImpactRequiresAck(),
        priceImpactAcknowledged: priceImpactAcknowledged(),
      },
      tokenType: tokenType(),
      isBuying: isBuying(),
    })
  );

  // Handle swap
  const handleSwap = (): void => {
    if (!canSwap()) return;

    swap({
      marketAddress: props.market.address,
      syAddress: props.market.syAddress,
      ptAddress: props.market.ptAddress,
      ytAddress: props.market.ytAddress,
      direction: direction(),
      amountIn: parsedInputAmount(),
      minAmountOut: minOutput(),
    });
  };

  // Clear input on success
  createEffect(
    on(isSuccess, (success) => {
      if (success) {
        setInputAmount('');
      }
    })
  );

  // Handle direction change with animation
  const toggleDirection = (): void => {
    setIsFlipping(true);
    setTimeout(() => {
      setIsBuying((prev) => !prev);
      setInputAmount('');
      resetSwap();
      setPriceImpactAcknowledged(false);
      setIsFlipping(false);
    }, 150);
  };

  // Handle token type change with confirmation feedback
  const handleTokenTypeChange = (newType: string): void => {
    if (!isValidTokenType(newType)) return;
    setTokenType(newType);
    setInputAmount('');
    resetSwap();
    setPriceImpactAcknowledged(false);
    toast.success(`Switched to ${newType}`, {
      description: getTokenTypeDescription(newType),
      duration: 2000,
    });
  };

  // Handle buy/sell change with confirmation feedback
  const handleDirectionChange = (value: string): void => {
    if (!isValidBuySell(value)) return;
    const buying = value === 'buy';
    setIsBuying(buying);
    setInputAmount('');
    resetSwap();
    setPriceImpactAcknowledged(false);
    const dirLabel = buying ? 'Buy mode' : 'Sell mode';
    const description = buying
      ? `Pay SY to receive ${tokenType()}`
      : `Pay ${tokenType()} to receive SY`;
    toast.success(dirLabel, { description, duration: 2000 });
  };

  return (
    <FormLayout class={props.class} gradient={uiState().formGradient}>
      {/* Token type + direction as inline pills */}
      <div class="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup class="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={tokenType() === 'PT'}
            onPressedChange={() => {
              handleTokenTypeChange('PT');
            }}
            class="data-[pressed]:bg-primary data-[pressed]:text-primary-foreground rounded-md px-4"
          >
            PT
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={tokenType() === 'YT'}
            onPressedChange={() => {
              handleTokenTypeChange('YT');
            }}
            class="data-[pressed]:bg-chart-2 data-[pressed]:text-foreground rounded-md px-4"
          >
            YT
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup class="bg-muted rounded-lg p-1">
          <ToggleGroupItem
            pressed={isBuying()}
            onPressedChange={() => {
              handleDirectionChange('buy');
            }}
            class="data-[pressed]:bg-primary/20 data-[pressed]:text-primary rounded-md px-4"
          >
            Buy
          </ToggleGroupItem>
          <ToggleGroupItem
            pressed={!isBuying()}
            onPressedChange={() => {
              handleDirectionChange('sell');
            }}
            class="data-[pressed]:bg-destructive/20 data-[pressed]:text-destructive rounded-md px-4"
          >
            Sell
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Near-expiry warning banner */}
      <Show when={!props.market.isExpired}>
        <NearExpiryWarning expiryTimestamp={props.market.expiry} context="swap" />
      </Show>

      {/* Input Section */}
      <FormInputSection>
        <NumberInput
          label="You pay"
          value={inputAmount()}
          onChange={setInputAmount}
          placeholder="0.00"
          error={uiState().inputError}
          rightElement={
            <span class="text-muted-foreground text-sm font-medium">{inputLabel()}</span>
          }
        />
      </FormInputSection>

      {/* Animated swap direction button */}
      <FormDivider>
        <div class="bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleDirection}
            class={cn(
              'bg-background h-10 w-10 rounded-full shadow-lg transition-transform duration-300',
              uiState().flipButtonClass
            )}
            aria-label="Toggle swap direction"
          >
            <ArrowUpDownIcon class="h-4 w-4" />
          </Button>
        </div>
      </FormDivider>

      {/* Output Preview */}
      <FormOutputSection>
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground shrink-0 text-sm">You receive</span>
          <span class="text-muted-foreground truncate text-xs">
            Min: {formatWad(minOutput(), 4)}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums">
            {formattedAnimatedOutput()}
          </span>
          {/* Token badge - using pre-computed styles */}
          <div
            class={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              outputBadgeStyle().containerClass
            )}
          >
            <span class={cn('font-mono text-sm font-semibold', outputBadgeStyle().textClass)}>
              {outputBadgeStyle().displayText}
            </span>
          </div>
        </div>
      </FormOutputSection>

      {/* Price Impact Display */}
      <Show when={isValidAmount()}>
        <div class="space-y-2">
          <FormRow
            label="Price Impact"
            labelClass="text-sm"
            valueClass={cn(
              'text-sm font-medium',
              priceImpactSeverity() === 'low' && 'text-muted-foreground',
              priceImpactSeverity() === 'medium' && 'text-warning',
              priceImpactSeverity() === 'high' && 'text-orange-500',
              priceImpactSeverity() === 'very-high' && 'text-destructive',
              priceImpactSeverity() === 'extreme' && 'text-destructive font-bold'
            )}
            value={`${(priceImpact() * 100).toFixed(2)}%`}
          />
          <FormRow
            label="Rate"
            labelClass="text-sm"
            valueClass="text-sm text-muted-foreground"
            value={`1 ${inputLabel()} = ${
              parsedInputAmount() > 0n
                ? (Number(expectedOutput()) / Number(parsedInputAmount())).toFixed(4)
                : '-'
            } ${outputLabel()}`}
          />
          <Show when={direction() === 'buy_pt' || direction() === 'sell_pt'}>
            <FormRow
              label="Implied APY"
              labelClass="text-sm"
              valueClass={cn(
                'text-sm',
                impliedApyAfter() > impliedApyBefore() && 'text-primary',
                impliedApyAfter() < impliedApyBefore() && 'text-destructive'
              )}
              value={`${(impliedApyBefore() * 100).toFixed(2)}% → ${(impliedApyAfter() * 100).toFixed(2)}%`}
            />
          </Show>
        </div>
      </Show>

      {/* Slippage Settings */}
      <div>
        <div class="text-muted-foreground mb-2 text-sm">Slippage Tolerance</div>
        <ToggleGroup class="flex gap-1">
          {SLIPPAGE_OPTIONS.map((option) => (
            <ToggleGroupItem
              pressed={slippageBps() === option.value}
              onPressedChange={() => {
                setSlippageBps(option.value);
              }}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* YT Sell Collateral Warning */}
      <Show when={uiState().showYtCollateralWarning}>
        <div class="bg-warning/10 border-warning/30 text-warning-foreground rounded-lg border p-3 text-sm">
          <p class="font-medium">Collateral Required</p>
          <p class="text-warning-foreground/80 mt-1">
            Selling YT requires {formatWad(collateralRequired(), 2)} {syLabel()} as collateral.
            This will be returned after the swap.
          </p>
        </div>
      </Show>

      {/* Transaction Status */}
      <Show when={isSwapping() || isSuccess() || isError()}>
        <div
          class={cn(
            'rounded-lg border p-3 text-sm',
            isSwapping() && 'border-primary/30 bg-primary/10',
            isSuccess() && 'border-success/30 bg-success/10',
            isError() && 'border-destructive/30 bg-destructive/10'
          )}
        >
          <Show when={isSwapping()}>
            <p class="text-primary font-medium">Transaction pending...</p>
          </Show>
          <Show when={isSuccess()}>
            <p class="text-success font-medium">Swap successful!</p>
            <Show when={transactionHash()}>
              <p class="text-success/80 mt-1 truncate text-xs">
                Tx: {transactionHash()}
              </p>
            </Show>
          </Show>
          <Show when={isError()}>
            <p class="text-destructive font-medium">Transaction failed</p>
            <Show when={error()}>
              <p class="text-destructive/80 mt-1 text-xs">{error()?.message}</p>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Submit Button */}
      <FormActions>
        <Button
          onClick={handleSwap}
          disabled={buttonState().disabled}
          loading={isSwapping()}
          size="xl"
          class={cn('w-full', uiState().sellButtonClass)}
        >
          {buttonState().label}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
