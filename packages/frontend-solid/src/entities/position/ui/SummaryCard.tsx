import { cn } from '@shared/lib/utils';
import { Card, CardContent } from '@shared/ui/Card';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'positive' | 'negative';
  action?: JSX.Element;
  class?: string;
}

export function SummaryCard(props: SummaryCardProps): JSX.Element {
  const variant = () => props.variant ?? 'default';

  return (
    <Card class={props.class}>
      <CardContent class="p-4">
        <div class="text-muted-foreground text-sm">{props.label}</div>
        <div
          class={cn(
            'mt-1 text-2xl font-semibold',
            variant() === 'positive' && 'text-primary',
            variant() === 'negative' && 'text-destructive',
            variant() === 'default' && 'text-foreground'
          )}
        >
          {props.value}
        </div>
        <Show when={props.subValue}>
          <div
            class={cn(
              'text-sm',
              variant() === 'positive' && 'text-primary/80',
              variant() === 'negative' && 'text-destructive/80',
              variant() === 'default' && 'text-muted-foreground'
            )}
          >
            {props.subValue}
          </div>
        </Show>
        <Show when={props.action !== undefined}>
          <div class="mt-2">{props.action}</div>
        </Show>
      </CardContent>
    </Card>
  );
}
