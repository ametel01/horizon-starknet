import { type ReactNode } from 'react';

import { formatWad, formatWadCompact } from '@/lib/math/wad';
import { cn } from '@/lib/utils';

interface TokenAmountProps {
  amount: bigint | string;
  symbol?: string;
  decimals?: number;
  /** Use compact formatting (e.g., 1.5M, 500K) for large numbers */
  compact?: boolean;
  className?: string;
}

export function TokenAmount({
  amount,
  symbol,
  decimals = 4,
  compact = false,
  className,
}: TokenAmountProps): ReactNode {
  const formatted = compact ? formatWadCompact(amount) : formatWad(amount, decimals);

  return (
    <span className={cn('font-mono', className)}>
      {formatted}
      {symbol ? <span className="text-muted-foreground ml-1">{symbol}</span> : null}
    </span>
  );
}

interface ApyDisplayProps {
  apy: number;
  className?: string;
}

export function ApyDisplay({ apy, className }: ApyDisplayProps): ReactNode {
  const isPositive = apy >= 0;
  const formatted = `${isPositive ? '+' : ''}${(apy * 100).toFixed(2)}%`;

  return (
    <span
      className={cn(
        'font-mono font-semibold',
        isPositive ? 'text-primary' : 'text-destructive',
        className
      )}
    >
      {formatted}
    </span>
  );
}
