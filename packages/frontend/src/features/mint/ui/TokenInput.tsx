'use client';

import { type ReactNode, useId, useState } from 'react';

import { useTokenBalance } from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { formatWad, fromWad } from '@shared/math/wad';
import { Card, CardContent } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

interface TokenInputProps {
  label: string;
  tokenAddress: string | null;
  tokenSymbol: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | undefined;
  /** Optional token type badge (e.g., "PT", "YT", "SY") */
  tokenType?: string | undefined;
  className?: string | undefined;
}

/**
 * TokenInput - Mobile-optimized token input component
 *
 * Features:
 * - Large touch-friendly targets (44px+ min)
 * - inputMode="decimal" for mobile numeric keyboard
 * - Combined balance/max button
 * - Token type badge with icon
 * - Smooth focus states and transitions
 */
export function TokenInput({
  label,
  tokenAddress,
  tokenSymbol,
  value,
  onChange,
  disabled = false,
  error,
  tokenType,
  className,
}: TokenInputProps): ReactNode {
  const inputId = useId();
  const errorId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const { data: balance, isLoading: balanceLoading } = useTokenBalance(tokenAddress);

  const handleMaxClick = (): void => {
    if (balance !== undefined) {
      const maxValue = fromWad(balance).toString();
      onChange(maxValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const inputValue = e.target.value;

    if (inputValue === '') {
      onChange('');
      return;
    }

    // Allow decimal numbers with up to 18 decimals
    const regex = /^\d*\.?\d{0,18}$/;
    if (regex.test(inputValue)) {
      onChange(inputValue);
    }
  };

  // Derive token type from symbol if not provided
  const displayTokenType = tokenType ?? tokenSymbol.split('-')[0];

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        isFocused && 'ring-primary/50 ring-2',
        error !== undefined && 'ring-destructive/50 ring-2',
        className
      )}
      role="group"
      aria-labelledby={`${inputId}-label`}
    >
      <CardContent className="space-y-3 overflow-hidden p-4">
        {/* Header row: Label and Balance/Max */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <label
            id={`${inputId}-label`}
            htmlFor={inputId}
            className="text-muted-foreground shrink-0 text-sm font-medium"
          >
            {label}
          </label>

          {/* Balance + Max combined button */}
          <button
            type="button"
            onClick={handleMaxClick}
            disabled={disabled || balance === undefined || balance === BigInt(0)}
            className={cn(
              'flex min-w-0 shrink items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors',
              'hover:bg-muted active:bg-muted/80',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            aria-label={`Set maximum ${tokenSymbol} amount`}
          >
            {balanceLoading ? (
              <Skeleton className="h-4 w-16" aria-label="Loading balance" />
            ) : (
              <>
                <span className="text-foreground truncate font-mono text-xs">
                  {balance !== undefined ? formatWad(balance, 4) : '0.00'}
                </span>
                <span className="text-primary shrink-0 text-xs font-semibold">MAX</span>
              </>
            )}
          </button>
        </div>

        {/* Input row: Amount and Token selector */}
        <div className="flex min-w-0 items-center gap-2">
          {/* Large, touch-friendly input */}
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            placeholder="0.00"
            disabled={disabled}
            aria-invalid={error !== undefined}
            aria-describedby={error !== undefined ? errorId : undefined}
            className={cn(
              'min-h-[44px] min-w-0 flex-1 bg-transparent outline-none',
              'font-mono text-2xl font-semibold tabular-nums',
              'placeholder:text-muted-foreground/40',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors'
            )}
          />

          {/* Token badge - compact, shows only token type */}
          <div
            className={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              displayTokenType === 'PT' && 'bg-primary/10',
              displayTokenType === 'YT' && 'bg-chart-2/10',
              displayTokenType === 'SY' && 'bg-chart-1/10',
              !['PT', 'YT', 'SY'].includes(displayTokenType ?? '') && 'bg-muted/80'
            )}
          >
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                displayTokenType === 'PT' && 'text-primary',
                displayTokenType === 'YT' && 'text-chart-2',
                displayTokenType === 'SY' && 'text-chart-1',
                !['PT', 'YT', 'SY'].includes(displayTokenType ?? '') && 'text-muted-foreground'
              )}
            >
              {displayTokenType ?? tokenSymbol.slice(0, 4)}
            </span>
          </div>
        </div>

        {/* Error message */}
        {error !== undefined && (
          <p id={errorId} className="text-destructive text-sm font-medium" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface TokenOutputProps {
  label: string;
  amount: bigint;
  tokenSymbol: string;
  isLoading?: boolean;
  /** Optional token type badge (e.g., "PT", "YT", "SY") */
  tokenType?: string | undefined;
  /** Optional minimum amount to display */
  minAmount?: bigint | undefined;
  className?: string | undefined;
}

/**
 * TokenOutput - Mobile-optimized token output display
 *
 * Features:
 * - Consistent styling with TokenInput
 * - Token type badge
 * - Optional minimum amount display
 * - Loading skeleton
 */
export function TokenOutput({
  label,
  amount,
  tokenSymbol,
  isLoading = false,
  tokenType,
  minAmount,
  className,
}: TokenOutputProps): ReactNode {
  const formattedAmount = formatWad(amount, 6);

  // Derive token type from symbol if not provided
  const displayTokenType = tokenType ?? tokenSymbol.split('-')[0];

  return (
    <Card
      className={cn('bg-muted/50 relative overflow-hidden', className)}
      role="status"
      aria-label={`${label}: ${formattedAmount} ${tokenSymbol}`}
    >
      <CardContent className="space-y-2 overflow-hidden p-4">
        {/* Header row */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-muted-foreground shrink-0 text-sm font-medium">{label}</span>
          {minAmount !== undefined && (
            <span className="text-muted-foreground truncate text-xs">
              Min: {formatWad(minAmount, 4)}
            </span>
          )}
        </div>

        {/* Output row */}
        <div className="flex min-w-0 items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-8 min-w-0 flex-1" aria-label="Loading amount" />
          ) : (
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums">
              {formattedAmount}
            </span>
          )}

          {/* Token badge - compact, shows only token type */}
          <div
            className={cn(
              'flex h-10 shrink-0 items-center justify-center rounded-full px-3',
              'border-border/50 border',
              displayTokenType === 'PT' && 'bg-primary/10',
              displayTokenType === 'YT' && 'bg-chart-2/10',
              displayTokenType === 'SY' && 'bg-chart-1/10',
              !['PT', 'YT', 'SY'].includes(displayTokenType ?? '') && 'bg-muted/50'
            )}
          >
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                displayTokenType === 'PT' && 'text-primary',
                displayTokenType === 'YT' && 'text-chart-2',
                displayTokenType === 'SY' && 'text-chart-1',
                !['PT', 'YT', 'SY'].includes(displayTokenType ?? '') && 'text-muted-foreground'
              )}
            >
              {displayTokenType ?? tokenSymbol.slice(0, 4)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
