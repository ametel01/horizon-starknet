'use client';

import { AlertCircle, AlertTriangle } from 'lucide-react';
import { type ReactNode, useCallback, useId, useMemo, useState } from 'react';

import { useTokenBalance } from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { formatWad, fromWad, toWad, WAD_BIGINT } from '@shared/math/wad';
import { useAnimatedNumber } from '@shared/ui/AnimatedNumber';
import { Card, CardContent } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/** Validation result with severity level */
interface ValidationResult {
  message: string;
  severity: 'error' | 'warning';
}

/** Minimum meaningful amount (0.0001 = dust threshold) */
const DUST_THRESHOLD = WAD_BIGINT / BigInt(10000); // 0.0001 in WAD

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
  /** Enable inline balance validation (Error Prevention) */
  validateBalance?: boolean | undefined;
  /** Minimum amount to show dust warning (default: 0.0001) */
  minAmount?: bigint | undefined;
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
  validateBalance = true,
  minAmount,
}: TokenInputProps): ReactNode {
  const inputId = useId();
  const errorId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const { data: balance, isLoading: balanceLoading } = useTokenBalance(tokenAddress);

  // Enhanced inline validation with severity levels (Error Prevention)
  const inlineValidation = useMemo((): ValidationResult | null => {
    // Skip validation if no value or disabled
    if (!value || value === '' || disabled) {
      return null;
    }

    try {
      const inputAmount = toWad(value);

      // Error: Insufficient balance (blocking)
      if (validateBalance && balance !== undefined && inputAmount > balance) {
        return { message: 'Insufficient balance', severity: 'error' };
      }

      // Warning: Zero amount
      if (inputAmount === BigInt(0)) {
        return { message: 'Enter an amount', severity: 'warning' };
      }

      // Warning: Dust amount (too small to be meaningful)
      const dustLimit = minAmount ?? DUST_THRESHOLD;
      if (inputAmount > BigInt(0) && inputAmount < dustLimit) {
        return { message: 'Amount may be too small', severity: 'warning' };
      }
    } catch {
      // Invalid input format - handled by input validation
      return null;
    }

    return null;
  }, [value, balance, validateBalance, disabled, minAmount]);

  // Combined validation (prop error takes precedence as error)
  const displayValidation = useMemo((): ValidationResult | null => {
    if (error) {
      return { message: error, severity: 'error' };
    }
    return inlineValidation;
  }, [error, inlineValidation]);

  // Convenience flags for styling
  const hasError = displayValidation?.severity === 'error';
  const hasWarning = displayValidation?.severity === 'warning';

  const handleMaxClick = (): void => {
    if (balance !== undefined) {
      const maxValue = fromWad(balance).toString();
      onChange(maxValue);
    }
  };

  // Prevent non-numeric input at keydown level (Error Prevention)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Allow control keys
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (allowedKeys.includes(e.key)) return;

    // Allow Ctrl/Cmd + A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;

    // Allow numbers
    if (/^[0-9]$/.test(e.key)) return;

    // Allow one decimal point if not already present
    if (e.key === '.' && !e.currentTarget.value.includes('.')) return;

    // Block everything else
    e.preventDefault();
  }, []);

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

  // Format cleanup on blur (Error Prevention)
  const handleBlur = useCallback((): void => {
    setIsFocused(false);

    if (!value) return;

    let cleanedValue = value;

    // Remove trailing decimal point: "123." -> "123"
    if (cleanedValue.endsWith('.')) {
      cleanedValue = cleanedValue.slice(0, -1);
    }

    // Remove leading zeros: "007" -> "7", but keep "0.7"
    if (cleanedValue.length > 1 && cleanedValue.startsWith('0') && cleanedValue[1] !== '.') {
      cleanedValue = cleanedValue.replace(/^0+/, '') || '0';
    }

    // Remove trailing zeros after decimal: "1.500" -> "1.5", but keep "1.0"
    if (cleanedValue.includes('.')) {
      cleanedValue = cleanedValue.replace(/\.?0+$/, '');
      // If we removed all decimals, ensure there's no trailing dot
      if (cleanedValue.endsWith('.')) {
        cleanedValue = cleanedValue.slice(0, -1);
      }
    }

    // Only update if value changed
    if (cleanedValue !== value) {
      onChange(cleanedValue);
    }
  }, [value, onChange]);

  // Derive token type from symbol if not provided
  const displayTokenType = tokenType ?? tokenSymbol.split('-')[0];

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        // Focus ring (lowest priority)
        isFocused && !hasError && !hasWarning && 'ring-primary/50 ring-2',
        // Warning ring (medium priority)
        hasWarning && 'ring-warning/50 ring-2',
        // Error ring (highest priority)
        hasError && 'ring-destructive/50 ring-2',
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
              // Focus indicator for keyboard accessibility (Feedback Principle)
              'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
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
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={handleBlur}
            placeholder="0.00"
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={displayValidation !== null ? errorId : undefined}
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

        {/* Validation message with icon (error or warning) */}
        {displayValidation !== null && (
          <p
            id={errorId}
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              hasError && 'text-destructive',
              hasWarning && 'text-warning'
            )}
            role={hasError ? 'alert' : 'status'}
          >
            {hasError ? (
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            )}
            {displayValidation.message}
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
  // Convert bigint to number for animation (Change Blindness prevention)
  const numericAmount = useMemo(() => fromWad(amount).toNumber(), [amount]);

  // Animate the numeric value with smooth easing
  const animatedAmount = useAnimatedNumber(numericAmount, {
    duration: 300,
    decimals: 6,
  });

  // Format the animated value
  const formattedAmount = useMemo(() => {
    // Handle edge cases
    if (animatedAmount === 0) return '0.000000';
    // Format with 6 decimal places, trim trailing zeros but keep at least 2
    const formatted = animatedAmount.toFixed(6);
    const parts = formatted.split('.');
    const intPart = parts[0] ?? '0';
    const decPart = parts[1];
    if (decPart !== undefined) {
      // Keep at least 2 decimal places
      const trimmed = decPart.replace(/0+$/, '').padEnd(2, '0');
      return `${intPart}.${trimmed}`;
    }
    return formatted;
  }, [animatedAmount]);

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
