import { cn } from '@shared/lib/utils';
import { formatWad, fromWad, parseWad } from '@shared/math/wad';
import { createAnimatedNumber } from '@shared/ui/AnimatedNumber';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import {
  FormActions,
  FormDivider,
  FormHeader,
  FormInfoSection,
  FormInputSection,
  FormLayout,
  FormRow,
} from '@shared/ui/FormLayout';
import { NearExpiryWarning } from '@shared/ui/NearExpiryWarning';
import { Skeleton } from '@shared/ui/Skeleton';
import { createEffect, createMemo, createSignal, type JSX, on, Show } from 'solid-js';
import type { MarketData } from '@/features/markets';
import { useStarknet } from '@/features/wallet';

import { calculateMinOutput, useMint } from '../model/useMint';

export interface MintFormProps {
  market: MarketData;
  class?: string;
}

/** Token type styling lookup */
const TOKEN_STYLES: Record<string, { bg: string; text: string }> = {
  PT: { bg: 'bg-primary/10', text: 'text-primary' },
  YT: { bg: 'bg-chart-2/10', text: 'text-chart-2' },
  SY: { bg: 'bg-chart-1/10', text: 'text-chart-1' },
};

const DEFAULT_TOKEN_STYLE = { bg: 'bg-muted/80', text: 'text-muted-foreground' };

function getTokenStyle(tokenType: string | undefined): { bg: string; text: string } {
  return TOKEN_STYLES[tokenType ?? ''] ?? DEFAULT_TOKEN_STYLE;
}

/**
 * ArrowDown icon for visual direction indicator
 */
function ArrowDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

/**
 * TokenOutput - Display component for output tokens
 */
interface TokenOutputProps {
  label: string;
  amount: bigint;
  tokenSymbol: string;
  tokenType?: string;
  isLoading?: boolean;
  class?: string;
}

function TokenOutput(props: TokenOutputProps): JSX.Element {
  // Convert bigint to number for animation (Change Blindness prevention)
  const numericAmount = createMemo(() => fromWad(props.amount).toNumber());

  // Animate the numeric value with smooth easing
  const animatedAmount = createAnimatedNumber(numericAmount, {
    duration: 300,
    decimals: 6,
  });

  // Format the animated value
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

  const displayTokenType = () => props.tokenType ?? props.tokenSymbol.split('-')[0];
  const tokenStyle = createMemo(() => getTokenStyle(displayTokenType()));

  return (
    <Card
      class={cn('bg-muted/50 relative overflow-hidden', props.class)}
      role="status"
      aria-label={`${props.label}: ${formattedAmount()} ${props.tokenSymbol}`}
    >
      <CardContent class="space-y-2 overflow-hidden p-4">
        {/* Header row */}
        <div class="flex min-w-0 items-center justify-between gap-2">
          <span class="text-muted-foreground shrink-0 text-sm font-medium">{props.label}</span>
        </div>

        {/* Output row */}
        <div class="flex min-w-0 items-center gap-2">
          <Show when={!props.isLoading} fallback={<Skeleton class="h-8 min-w-0 flex-1" />}>
            <span class="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums">
              {formattedAmount()}
            </span>
          </Show>

          {/* Token badge */}
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
      </CardContent>
    </Card>
  );
}

/**
 * TokenInput - Input component for SY amount
 */
interface TokenInputProps {
  label: string;
  tokenSymbol: string;
  tokenType?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  error?: string | undefined;
  class?: string | undefined;
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
        {/* Header row: Label */}
        <div class="flex min-w-0 items-center justify-between gap-2">
          <span class="text-muted-foreground shrink-0 text-sm font-medium">{props.label}</span>
        </div>

        {/* Input row: Amount and Token badge */}
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
              // Allow decimal numbers with up to 18 decimals
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

          {/* Token badge */}
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

        {/* Error message */}
        <Show when={props.error}>
          <p class="text-destructive flex items-center gap-1.5 text-sm font-medium" role="alert">
            {props.error}
          </p>
        </Show>
      </CardContent>
    </Card>
  );
}

/**
 * MintForm - SolidJS port of the mint form component
 *
 * Features:
 * - SY input with validation
 * - PT + YT output preview
 * - 1:1 exchange rate display
 * - Transaction status feedback
 * - Slippage protection (0.5% default)
 */
export function MintForm(props: MintFormProps): JSX.Element {
  const { isConnected } = useStarknet();

  // Form state
  const [amountSy, setAmountSy] = createSignal('');
  const [slippageBps] = createSignal(50); // 0.5% default

  const {
    mint,
    isMinting,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset: resetMint,
  } = useMint();

  // Calculate output amounts (1:1 ratio for PT and YT)
  const outputAmount = createMemo(() => {
    const amount = amountSy();
    if (!amount || amount === '0') {
      return BigInt(0);
    }
    try {
      return parseWad(amount);
    } catch {
      return BigInt(0);
    }
  });

  // Calculate minimum output with slippage
  const minOutput = createMemo(() => calculateMinOutput(outputAmount(), slippageBps()));

  // Validation
  const validationError = createMemo(() => {
    const amount = amountSy();
    if (!amount || amount === '0') {
      return null;
    }

    try {
      const amountWad = parseWad(amount);
      if (amountWad === 0n) {
        return null;
      }
    } catch {
      return 'Invalid amount';
    }

    return null;
  });

  // Button state
  const buttonDisabled = createMemo(
    () =>
      !isConnected() ||
      !amountSy() ||
      amountSy() === '0' ||
      !!validationError() ||
      isMinting() ||
      props.market.isExpired
  );

  const buttonText = createMemo(() => {
    if (!isConnected()) return 'Connect Wallet';
    if (props.market.isExpired) return 'Market Expired';
    if (isMinting()) return 'Minting...';
    if (validationError()) return validationError();
    if (!amountSy() || amountSy() === '0') return 'Enter Amount';
    return 'Mint PT + YT';
  });

  // Handle mint
  const handleMint = (): void => {
    if (buttonDisabled()) return;

    const amountWad = parseWad(amountSy());
    if (amountWad === 0n) return;

    mint({
      syAddress: props.market.syAddress,
      ytAddress: props.market.ytAddress,
      amountSy: amountWad,
      minPyOut: minOutput(),
    });
  };

  // Clear input on success
  createEffect(
    on(isSuccess, (success) => {
      if (success) {
        setAmountSy('');
      }
    })
  );

  // Handle reset after success
  const handleReset = (): void => {
    setAmountSy('');
    resetMint();
  };

  // Get token symbols from metadata
  const tokenSymbol = () => props.market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = () => `SY-${tokenSymbol()}`;
  const ptSymbol = () => `PT-${tokenSymbol()}`;
  const ytSymbol = () => `YT-${tokenSymbol()}`;

  return (
    <FormLayout gradient="primary" class={props.class}>
      {/* Header */}
      <FormHeader
        title="Mint PT + YT"
        description="Split your deposit into Principal Token and Yield Token"
      />

      {/* Near-expiry warning banner */}
      <Show when={!props.market.isExpired}>
        <NearExpiryWarning expiryTimestamp={props.market.expiry} context="mint" />
      </Show>

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You use"
          tokenSymbol={sySymbol()}
          tokenType="SY"
          value={amountSy()}
          onChange={setAmountSy}
          disabled={isMinting()}
          error={validationError() ?? undefined}
        />
      </FormInputSection>

      {/* Divider */}
      <FormDivider>
        <div class="bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Button
            variant="outline"
            size="icon"
            class="bg-background h-10 w-10 rounded-full shadow-lg"
            disabled
          >
            <ArrowDownIcon class="text-muted-foreground h-4 w-4" />
          </Button>
        </div>
      </FormDivider>

      {/* Outputs */}
      <div class="space-y-2">
        <TokenOutput
          label="You receive"
          amount={outputAmount()}
          tokenSymbol={ptSymbol()}
          tokenType="PT"
        />
        <TokenOutput
          label="You receive"
          amount={outputAmount()}
          tokenSymbol={ytSymbol()}
          tokenType="YT"
        />
      </div>

      {/* Info Section */}
      <FormInfoSection>
        <FormRow label="Exchange Rate" value="1 SY = 1 PT + 1 YT" />
        <Show when={outputAmount() > 0n}>
          <FormRow
            label="Minimum Output"
            value={`${formatWad(minOutput(), 4)} PT + ${formatWad(minOutput(), 4)} YT`}
          />
        </Show>
      </FormInfoSection>

      {/* Transaction Status */}
      <Show when={isMinting() || isSuccess() || isError()}>
        <div
          class={cn(
            'rounded-lg border p-3 text-sm',
            isMinting() && 'border-primary/30 bg-primary/10',
            isSuccess() && 'border-success/30 bg-success/10',
            isError() && 'border-destructive/30 bg-destructive/10'
          )}
        >
          <Show when={isMinting()}>
            <p class="text-primary font-medium">Transaction pending...</p>
          </Show>
          <Show when={isSuccess()}>
            <p class="text-success font-medium">Mint successful!</p>
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
              Mint More
            </Button>
          }
        >
          <Button
            onClick={handleMint}
            disabled={buttonDisabled()}
            loading={isMinting()}
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
