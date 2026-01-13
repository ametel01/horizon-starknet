import { cn } from '@shared/lib/utils';
import { formatWad, fromWad, parseWad } from '@shared/math/wad';
import { createAnimatedNumber } from '@shared/ui/AnimatedNumber';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import {
  FormActions,
  FormHeader,
  FormInfoSection,
  FormInputSection,
  FormLayout,
  FormRow,
} from '@shared/ui/FormLayout';
import { Skeleton } from '@shared/ui/Skeleton';
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from 'solid-js';
import type { MarketData } from '@/features/markets';
import { useStarknet } from '@/features/wallet';

import {
  calculateBalancedAmounts,
  calculateMinLpOut,
  useAddLiquidity,
} from '../model/useLiquidity';

export interface AddLiquidityFormProps {
  market: MarketData;
  class?: string;
}

/** Token type styling lookup */
const TOKEN_STYLES: Record<string, { bg: string; text: string }> = {
  PT: { bg: 'bg-primary/10', text: 'text-primary' },
  YT: { bg: 'bg-chart-2/10', text: 'text-chart-2' },
  SY: { bg: 'bg-chart-1/10', text: 'text-chart-1' },
  LP: { bg: 'bg-chart-3/10', text: 'text-chart-3' },
};

const DEFAULT_TOKEN_STYLE = { bg: 'bg-muted/80', text: 'text-muted-foreground' };

function getTokenStyle(tokenType: string | undefined): { bg: string; text: string } {
  return TOKEN_STYLES[tokenType ?? ''] ?? DEFAULT_TOKEN_STYLE;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

// ==================== Helper Functions ====================

function parseAmountSafe(amount: string): bigint {
  if (!amount || amount === '') return 0n;
  try {
    return parseWad(amount);
  } catch {
    return 0n;
  }
}

function calculateExpectedLp(
  syAmount: bigint,
  ptAmount: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  totalLpSupply: bigint
): bigint {
  if (syAmount === 0n || ptAmount === 0n) {
    return 0n;
  }

  if (totalLpSupply === 0n || syReserve === 0n || ptReserve === 0n) {
    // Initial liquidity - use geometric mean approximation
    return syAmount < ptAmount ? syAmount : ptAmount;
  }

  // Calculate LP based on proportional contribution
  const lpFromSy = (syAmount * totalLpSupply) / syReserve;
  const lpFromPt = (ptAmount * totalLpSupply) / ptReserve;
  return lpFromSy < lpFromPt ? lpFromSy : lpFromPt;
}

// ==================== Sub-components ====================

interface TokenInputProps {
  label: string;
  tokenSymbol: string;
  tokenType?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  class?: string;
}

function TokenInput(props: TokenInputProps): JSX.Element {
  const [isFocused, setIsFocused] = createSignal(false);

  const displayTokenType = () => props.tokenType ?? props.tokenSymbol.split('-')[0];
  const tokenStyle = createMemo(() => getTokenStyle(displayTokenType()));

  const hasError = () => !!props.error;

  const cardRingClass = createMemo(() => {
    if (hasError()) return 'ring-destructive/50 ring-2';
    if (isFocused()) return 'ring-primary/50 ring-2';
    return undefined;
  });

  return (
    <Card
      class={cn(
        'group relative overflow-hidden transition-all duration-200',
        cardRingClass(),
        props.class
      )}
      role="group"
    >
      <CardContent class="space-y-3 overflow-hidden p-4">
        <div class="flex min-w-0 items-center justify-between gap-2">
          <span class="text-muted-foreground shrink-0 text-sm font-medium">{props.label}</span>
        </div>

        <div class="flex min-w-0 items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            autocomplete="off"
            value={props.value}
            onInput={(e) => {
              const inputValue = e.currentTarget.value;
              if (inputValue === '') {
                props.onChange('');
                return;
              }
              const regex = /^\d*\.?\d{0,18}$/;
              if (regex.test(inputValue)) {
                props.onChange(inputValue);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="0.00"
            disabled={props.disabled}
            aria-invalid={hasError()}
            class={cn(
              'min-h-[44px] min-w-0 flex-1 bg-transparent outline-none',
              'font-mono text-2xl font-semibold tabular-nums',
              'placeholder:text-muted-foreground/40',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors'
            )}
          />

          <div
            class={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              tokenStyle().bg
            )}
          >
            <span class={cn('font-mono text-sm font-semibold', tokenStyle().text)}>
              {displayTokenType()}
            </span>
          </div>
        </div>

        <Show when={props.error}>
          <p class="text-destructive flex items-center gap-1.5 text-sm font-medium" role="alert">
            {props.error}
          </p>
        </Show>
      </CardContent>
    </Card>
  );
}

interface LpOutputProps {
  amount: bigint;
  minAmount: bigint;
  isValid: boolean;
  isLoading?: boolean;
  class?: string;
}

function LpOutput(props: LpOutputProps): JSX.Element {
  const numericAmount = createMemo(() => fromWad(props.amount).toNumber());
  const animatedAmount = createAnimatedNumber(numericAmount, {
    duration: 300,
    decimals: 6,
  });

  const formattedAmount = createMemo(() => {
    const value = animatedAmount();
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

  const tokenStyle = createMemo(() => getTokenStyle('LP'));

  return (
    <Card
      class={cn('bg-muted/50 relative overflow-hidden', props.class)}
      role="status"
      aria-label={`Expected LP Tokens: ${formattedAmount()}`}
    >
      <CardContent class="space-y-2 overflow-hidden p-4">
        <div class="flex min-w-0 items-center justify-between gap-2">
          <span class="text-muted-foreground shrink-0 text-sm font-medium">Expected LP Tokens</span>
          <span class="text-muted-foreground text-sm">
            Min: {props.isValid ? formatWad(props.minAmount, 6) : '-'} LP
          </span>
        </div>

        <div class="flex min-w-0 items-center gap-2">
          <Show when={!props.isLoading} fallback={<Skeleton class="h-8 min-w-0 flex-1" />}>
            <span class="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums">
              {formattedAmount()}
            </span>
          </Show>

          <div
            class={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              tokenStyle().bg
            )}
          >
            <span class={cn('font-mono text-sm font-semibold', tokenStyle().text)}>LP</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Main Component ====================

/**
 * AddLiquidityForm - SolidJS port of the add liquidity form component
 *
 * Features:
 * - SY and PT input with validation
 * - Balanced deposit mode (auto-calculate PT based on pool ratio)
 * - LP output preview with slippage
 * - Pool share calculation
 * - Transaction status feedback
 */
export function AddLiquidityForm(props: AddLiquidityFormProps): JSX.Element {
  const { isConnected } = useStarknet();

  // Form state
  const [syAmount, setSyAmount] = createSignal('');
  const [ptAmount, setPtAmount] = createSignal('');
  const [slippageBps, setSlippageBps] = createSignal(50); // 0.5% default
  const [isBalanced, setIsBalanced] = createSignal(true);

  const {
    addLiquidity,
    isAdding,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetAddLiquidity,
  } = useAddLiquidity();

  // Get token symbols from metadata
  const tokenSymbol = () => props.market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = () => `SY-${tokenSymbol()}`;
  const ptSymbol = () => `PT-${tokenSymbol()}`;

  // Parse amounts
  const parsedSyAmount = createMemo(() => parseAmountSafe(syAmount()));
  const parsedPtAmount = createMemo(() => parseAmountSafe(ptAmount()));

  // Calculate balanced amounts when SY changes
  createEffect(
    on([() => syAmount(), isBalanced], ([sy, balanced]) => {
      if (balanced && sy && props.market.state.syReserve > 0n) {
        const { ptAmount: calculatedPt } = calculateBalancedAmounts(
          parsedSyAmount(),
          true,
          props.market.state.syReserve,
          props.market.state.ptReserve
        );
        setPtAmount(formatWad(calculatedPt, 18));
      }
    })
  );

  // Calculate expected LP output
  const expectedLpOut = createMemo(() =>
    calculateExpectedLp(
      parsedSyAmount(),
      parsedPtAmount(),
      props.market.state.syReserve,
      props.market.state.ptReserve,
      props.market.state.totalLpSupply
    )
  );

  // Calculate minimum LP output with slippage
  const minLpOut = createMemo(() =>
    calculateMinLpOut(
      parsedSyAmount(),
      parsedPtAmount(),
      props.market.state.syReserve,
      props.market.state.ptReserve,
      props.market.state.totalLpSupply,
      slippageBps()
    )
  );

  // Calculate share of pool
  const poolShare = createMemo(() => {
    if (expectedLpOut() === 0n) return 0;
    const newTotalSupply = props.market.state.totalLpSupply + expectedLpOut();
    if (newTotalSupply === 0n) return 100;
    return (Number(expectedLpOut()) / Number(newTotalSupply)) * 100;
  });

  // Validation
  const isValidAmount = createMemo(() => parsedSyAmount() > 0n && parsedPtAmount() > 0n);

  const buttonDisabled = createMemo(
    () => !isConnected() || !isValidAmount() || isAdding() || props.market.isExpired
  );

  const buttonText = createMemo(() => {
    if (!isConnected()) return 'Connect Wallet';
    if (props.market.isExpired) return 'Market Expired';
    if (isAdding()) return 'Adding Liquidity...';
    if (!isValidAmount()) return 'Enter Amounts';
    return 'Add Liquidity';
  });

  // Handle add liquidity
  const handleAddLiquidity = (): void => {
    if (buttonDisabled()) return;

    addLiquidity({
      marketAddress: props.market.address,
      syAddress: props.market.syAddress,
      ptAddress: props.market.ptAddress,
      syAmount: parsedSyAmount(),
      ptAmount: parsedPtAmount(),
      minLpOut: minLpOut(),
    });
  };

  // Clear inputs on success
  createEffect(
    on(isSuccess, (success) => {
      if (success) {
        setSyAmount('');
        setPtAmount('');
      }
    })
  );

  // Handle reset after success
  const handleReset = (): void => {
    setSyAmount('');
    setPtAmount('');
    resetAddLiquidity();
  };

  // Handle balanced mode toggle
  const handleBalancedChange = (checked: boolean): void => {
    setIsBalanced(checked);
    if (checked && syAmount() && props.market.state.syReserve > 0n) {
      const { ptAmount: calculatedPt } = calculateBalancedAmounts(
        parsedSyAmount(),
        true,
        props.market.state.syReserve,
        props.market.state.ptReserve
      );
      setPtAmount(formatWad(calculatedPt, 18));
    }
  };

  return (
    <FormLayout gradient="primary" class={props.class}>
      {/* Header */}
      <FormHeader title="Add Liquidity" description="Provide SY and PT to earn trading fees" />

      {/* Balanced Mode Toggle */}
      <div class="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isBalanced()}
          onClick={() => handleBalancedChange(!isBalanced())}
          class={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isBalanced() ? 'bg-primary' : 'bg-input'
          )}
        >
          <span
            class={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
              isBalanced() ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
        <span class="text-muted-foreground text-sm">Balanced deposit</span>
      </div>

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="SY Amount"
          tokenSymbol={sySymbol()}
          tokenType="SY"
          value={syAmount()}
          onChange={setSyAmount}
          disabled={isAdding()}
        />
        <TokenInput
          label="PT Amount"
          tokenSymbol={ptSymbol()}
          tokenType="PT"
          value={ptAmount()}
          onChange={(value) => {
            if (!isBalanced()) {
              setPtAmount(value);
            }
          }}
          disabled={isBalanced() || isAdding()}
        />
      </FormInputSection>

      {/* Output Preview */}
      <LpOutput amount={expectedLpOut()} minAmount={minLpOut()} isValid={isValidAmount()} />

      {/* Pool Info */}
      <FormInfoSection>
        <FormRow
          label="Share of Pool"
          value={isValidAmount() ? `${poolShare().toFixed(4)}%` : '-'}
        />
        <FormRow label="Slippage Tolerance" value={`${(slippageBps() / 100).toString()}%`} />
      </FormInfoSection>

      {/* Slippage Settings */}
      <div>
        <div class="text-muted-foreground mb-2 text-sm">Slippage Tolerance</div>
        <div class="flex gap-1">
          <For each={SLIPPAGE_OPTIONS}>
            {(option) => (
              <Button
                variant={slippageBps() === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSlippageBps(option.value)}
              >
                {option.label}
              </Button>
            )}
          </For>
        </div>
      </div>

      {/* Transaction Status */}
      <Show when={isAdding() || isSuccess() || isError()}>
        <div
          class={cn(
            'rounded-lg border p-3 text-sm',
            isAdding() && 'border-primary/30 bg-primary/10',
            isSuccess() && 'border-success/30 bg-success/10',
            isError() && 'border-destructive/30 bg-destructive/10'
          )}
        >
          <Show when={isAdding()}>
            <p class="text-primary font-medium">Transaction pending...</p>
          </Show>
          <Show when={isSuccess()}>
            <p class="text-success font-medium">Liquidity added successfully!</p>
            <Show when={transactionHash()}>
              <p class="text-success/80 mt-1 truncate text-xs">Tx: {transactionHash()}</p>
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

      {/* Actions */}
      <FormActions>
        <Show
          when={!isSuccess()}
          fallback={
            <Button onClick={handleReset} variant="default" size="xl" class="w-full">
              Add More Liquidity
            </Button>
          }
        >
          <Button
            onClick={handleAddLiquidity}
            disabled={buttonDisabled()}
            loading={isAdding()}
            size="xl"
            class="w-full"
          >
            {buttonText()}
          </Button>
        </Show>
      </FormActions>
    </FormLayout>
  );
}
