import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import type { JSX } from 'solid-js';

interface TokenAmountProps {
  amount: bigint | string;
  symbol?: string;
  decimals?: number;
  /** Use compact formatting (e.g., 1.5M, 500K) for large numbers */
  compact?: boolean;
  class?: string;
}

export function TokenAmount(props: TokenAmountProps): JSX.Element {
  const formatted = () =>
    props.compact ? formatWadCompact(props.amount) : formatWad(props.amount, props.decimals ?? 4);

  return (
    <span class={cn('font-mono', props.class)}>
      {formatted()}
      {props.symbol ? <span class="text-muted-foreground ml-1">{props.symbol}</span> : null}
    </span>
  );
}

interface ApyDisplayProps {
  apy: number;
  class?: string;
}

export function ApyDisplay(props: ApyDisplayProps): JSX.Element {
  const isPositive = () => props.apy >= 0;
  const formatted = () => `${isPositive() ? '+' : ''}${(props.apy * 100).toFixed(2)}%`;

  return (
    <span
      class={cn(
        'font-mono font-semibold',
        isPositive() ? 'text-primary' : 'text-destructive',
        props.class
      )}
    >
      {formatted()}
    </span>
  );
}
