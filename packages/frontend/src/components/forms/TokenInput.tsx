'use client';

import { type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatWad, fromWad } from '@/lib/math/wad';

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
  const { data: balance, isLoading: balanceLoading } = useTokenBalance(tokenAddress);

  const handleMaxClick = (): void => {
    if (balance !== undefined) {
      // Convert from WAD to decimal string
      const maxValue = fromWad(balance).toString();
      onChange(maxValue);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-neutral-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Balance:</span>
          {balanceLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <span className="font-mono text-sm text-neutral-300">
              {balance !== undefined ? formatWad(balance, 4) : '0.0000'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NumberInput
          value={value}
          onChange={onChange}
          placeholder="0.0"
          disabled={disabled}
          error={error}
          className="border-0 bg-transparent text-2xl focus:ring-0"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMaxClick}
            disabled={disabled || balance === undefined || balance === BigInt(0)}
          >
            MAX
          </Button>
          <span className="min-w-[60px] text-right font-medium text-neutral-100">
            {tokenSymbol}
          </span>
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
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
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <div className="mb-2">
        <span className="text-sm text-neutral-400">{label}</span>
      </div>

      <div className="flex items-center justify-between">
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <span className="font-mono text-2xl text-neutral-100">{formatWad(amount, 4)}</span>
        )}
        <span className="font-medium text-neutral-100">{tokenSymbol}</span>
      </div>
    </div>
  );
}
