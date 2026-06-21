import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import type { ReactNode } from 'react';

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
