'use client';

import { type ReactNode, useId } from 'react';

import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWad, fromWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { NumberInput } from '@shared/ui/Input';
import { Skeleton } from '@shared/ui/Skeleton';

interface TokenInputProps {
  label: string;
  tokenAddress: string | null;
  tokenSymbol: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | undefined;
}

export function TokenInput({
  label,
  tokenAddress,
  tokenSymbol,
  value,
  onChange,
  disabled = false,
  error,
}: TokenInputProps): ReactNode {
  const inputId = useId();
  const errorId = useId();
  const { data: balance, isLoading: balanceLoading } = useTokenBalance(tokenAddress);

  const handleMaxClick = (): void => {
    if (balance !== undefined) {
      // Convert from WAD to decimal string
      const maxValue = fromWad(balance).toString();
      onChange(maxValue);
    }
  };

  return (
    <Card size="sm" className="bg-muted" role="group" aria-labelledby={`${inputId}-label`}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <label
            id={`${inputId}-label`}
            htmlFor={inputId}
            className="text-muted-foreground text-sm"
          >
            {label}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Balance:</span>
            {balanceLoading ? (
              <Skeleton className="h-4 w-16" aria-label="Loading balance" />
            ) : (
              <span
                className="text-foreground font-mono text-sm"
                aria-label={`Balance: ${balance !== undefined ? formatWad(balance, 4) : '0.0000'} ${tokenSymbol}`}
              >
                {balance !== undefined ? formatWad(balance, 4) : '0.0000'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NumberInput
            id={inputId}
            value={value}
            onChange={onChange}
            placeholder="0.0"
            disabled={disabled}
            aria-invalid={error !== undefined}
            aria-describedby={error !== undefined ? errorId : undefined}
            className="border-0 bg-transparent text-2xl focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMaxClick}
              disabled={disabled || balance === undefined || balance === BigInt(0)}
              aria-label={`Set maximum ${tokenSymbol} amount`}
            >
              MAX
            </Button>
            <span
              className="text-foreground min-w-[60px] text-right font-medium"
              aria-hidden="true"
            >
              {tokenSymbol}
            </span>
          </div>
        </div>

        {error !== undefined ? (
          <p id={errorId} className="text-destructive mt-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface TokenOutputProps {
  label: string;
  amount: bigint;
  tokenSymbol: string;
  isLoading?: boolean;
}

export function TokenOutput({
  label,
  amount,
  tokenSymbol,
  isLoading = false,
}: TokenOutputProps): ReactNode {
  const formattedAmount = formatWad(amount, 4);

  return (
    <Card
      size="sm"
      className="bg-muted"
      role="status"
      aria-label={`${label}: ${formattedAmount} ${tokenSymbol}`}
    >
      <CardContent className="p-4">
        <div className="mb-2">
          <span className="text-muted-foreground text-sm">{label}</span>
        </div>

        <div className="flex items-center justify-between">
          {isLoading ? (
            <Skeleton className="h-8 w-32" aria-label="Loading amount" />
          ) : (
            <span className="text-foreground font-mono text-2xl">{formattedAmount}</span>
          )}
          <span className="text-foreground font-medium" aria-hidden="true">
            {tokenSymbol}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
