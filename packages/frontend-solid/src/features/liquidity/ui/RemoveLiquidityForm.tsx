import { createEffect, createMemo, createSignal, For, on, Show, type JSX } from 'solid-js';

import { type MarketData } from '@/features/markets';
import { useStarknet } from '@/features/wallet';
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

import { calculateMinOutputs, useRemoveLiquidity } from '../model/useLiquidity';

export interface RemoveLiquidityFormProps {
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

const PERCENTAGE_OPTIONS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: 'Max', value: 100 },
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

function calculateExpectedOutputs(
  lpAmount: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  totalLpSupply: bigint
): { expectedSyOut: bigint; expectedPtOut: bigint } {
  if (lpAmount === 0n || totalLpSupply === 0n) {
    return { expectedSyOut: 0n, expectedPtOut: 0n };
  }
  return {
    expectedSyOut: (lpAmount * syReserve) / totalLpSupply,
    expectedPtOut: (lpAmount * ptReserve) / totalLpSupply,
  };
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

interface OutputPreviewRowProps {
  label: string;
  amount: bigint;
  minAmount: bigint;
  tokenType: string;
  isValid: boolean;
  isLoading?: boolean;
}

function OutputPreviewRow(props: OutputPreviewRowProps): JSX.Element {
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

  const tokenStyle = createMemo(() => getTokenStyle(props.tokenType));

  return (
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Show
          when={!props.isLoading}
          fallback={<Skeleton class="h-6 w-24" />}
        >
          <span
            class={cn(
              'font-mono text-lg font-semibold tabular-nums',
              props.isValid ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {formattedAmount()}
          </span>
        </Show>
        <div
          class={cn(
            'flex h-6 shrink-0 items-center justify-center rounded-full px-2',
            'border-border/50 border',
            tokenStyle().bg
          )}
        >
          <span class={cn('font-mono text-xs font-semibold', tokenStyle().text)}>
            {props.tokenType}
          </span>
        </div>
      </div>
      <span class="text-muted-foreground text-sm">
        min: {props.isValid ? formatWad(props.minAmount, 6) : '-'}
      </span>
    </div>
  );
}

// ==================== Main Component ====================

/**
 * RemoveLiquidityForm - SolidJS port of the remove liquidity form component
 *
 * Features:
 * - LP input with validation
 * - Percentage buttons for quick amounts
 * - SY and PT output preview with slippage
 * - Pool share removed calculation
 * - Transaction status feedback
 */
export function RemoveLiquidityForm(props: RemoveLiquidityFormProps): JSX.Element {
  const { isConnected } = useStarknet();

  // Form state
  const [lpAmount, setLpAmount] = createSignal('');
  const [slippageBps, setSlippageBps] = createSignal(50); // 0.5% default

  const {
    removeLiquidity,
    isRemoving,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetRemoveLiquidity,
  } = useRemoveLiquidity();

  // Get token symbols from metadata
  const tokenSymbol = () => props.market.metadata?.yieldTokenSymbol ?? 'Token';
  const lpSymbol = () => `LP-${tokenSymbol()}`;

  // Parse LP amount
  const parsedLpAmount = createMemo(() => parseAmountSafe(lpAmount()));

  // Calculate expected outputs
  const expectedOutputs = createMemo(() =>
    calculateExpectedOutputs(
      parsedLpAmount(),
      props.market.state.syReserve,
      props.market.state.ptReserve,
      props.market.state.totalLpSupply
    )
  );

  // Calculate minimum outputs with slippage
  const minOutputs = createMemo(() =>
    calculateMinOutputs(
      parsedLpAmount(),
      props.market.state.syReserve,
      props.market.state.ptReserve,
      props.market.state.totalLpSupply,
      slippageBps()
    )
  );

  // Calculate share of pool being removed
  const poolShareRemoved = createMemo(() => {
    if (parsedLpAmount() === 0n || props.market.state.totalLpSupply === 0n) {
      return 0;
    }
    return (Number(parsedLpAmount()) / Number(props.market.state.totalLpSupply)) * 100;
  });

  // Validation
  const isValidAmount = createMemo(() => parsedLpAmount() > 0n);

  const buttonDisabled = createMemo(
    () => !isConnected() || !isValidAmount() || isRemoving()
  );

  const buttonText = createMemo(() => {
    if (!isConnected()) return 'Connect Wallet';
    if (isRemoving()) return 'Removing Liquidity...';
    if (!isValidAmount()) return 'Enter Amount';
    return 'Remove Liquidity';
  });

  // Handle remove liquidity
  const handleRemoveLiquidity = (): void => {
    if (buttonDisabled()) return;

    removeLiquidity({
      marketAddress: props.market.address,
      syAddress: props.market.syAddress,
      ptAddress: props.market.ptAddress,
      lpAmount: parsedLpAmount(),
      minSyOut: minOutputs().minSyOut,
      minPtOut: minOutputs().minPtOut,
    });
  };

  // Handle percentage buttons
  // TODO: Integrate with useTokenBalance hook to get actual LP balance
  // Currently, percentage buttons only work after entering an amount manually.
  // In production, this should use the user's actual LP token balance:
  //   const { data: lpBalance } = useTokenBalance(props.market.address);
  //   const baseAmount = lpBalance ?? parsedLpAmount();
  const handlePercentage = (percentage: number): void => {
    const currentAmount = parsedLpAmount();
    if (currentAmount > 0n) {
      const newAmount = (currentAmount * BigInt(percentage)) / 100n;
      setLpAmount(formatWad(newAmount, 18));
    }
  };

  // Clear input on success
  createEffect(
    on(isSuccess, (success) => {
      if (success) {
        setLpAmount('');
      }
    })
  );

  // Handle reset after success
  const handleReset = (): void => {
    setLpAmount('');
    resetRemoveLiquidity();
  };

  return (
    <FormLayout gradient="primary" class={props.class}>
      {/* Header */}
      <FormHeader
        title="Remove Liquidity"
        description="Burn LP tokens to receive SY and PT"
      />

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="LP to Remove"
          tokenSymbol={lpSymbol()}
          tokenType="LP"
          value={lpAmount()}
          onChange={setLpAmount}
          disabled={isRemoving()}
        />
      </FormInputSection>

      {/* Percentage Buttons */}
      <div class="flex gap-2">
        <For each={PERCENTAGE_OPTIONS}>
          {(option) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePercentage(option.value)}
              class="flex-1"
            >
              {option.label}
            </Button>
          )}
        </For>
      </div>

      {/* Output Preview */}
      <Card class="bg-muted/50">
        <CardContent class="space-y-3 p-4">
          <div class="text-muted-foreground text-sm">You will receive</div>
          <OutputPreviewRow
            label="SY"
            amount={expectedOutputs().expectedSyOut}
            minAmount={minOutputs().minSyOut}
            tokenType="SY"
            isValid={isValidAmount()}
          />
          <OutputPreviewRow
            label="PT"
            amount={expectedOutputs().expectedPtOut}
            minAmount={minOutputs().minPtOut}
            tokenType="PT"
            isValid={isValidAmount()}
          />
        </CardContent>
      </Card>

      {/* Pool Info */}
      <FormInfoSection>
        <FormRow
          label="Pool Share Removed"
          value={isValidAmount() ? `${poolShareRemoved().toFixed(4)}%` : '-'}
        />
        <FormRow
          label="Slippage Tolerance"
          value={`${(slippageBps() / 100).toString()}%`}
        />
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
      <Show when={isRemoving() || isSuccess() || isError()}>
        <div
          class={cn(
            'rounded-lg border p-3 text-sm',
            isRemoving() && 'border-primary/30 bg-primary/10',
            isSuccess() && 'border-success/30 bg-success/10',
            isError() && 'border-destructive/30 bg-destructive/10'
          )}
        >
          <Show when={isRemoving()}>
            <p class="text-primary font-medium">Transaction pending...</p>
          </Show>
          <Show when={isSuccess()}>
            <p class="text-success font-medium">Liquidity removed successfully!</p>
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
              Remove More Liquidity
            </Button>
          }
        >
          <Button
            onClick={handleRemoveLiquidity}
            disabled={buttonDisabled()}
            loading={isRemoving()}
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
