import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { daysToExpiry, formatExpiry } from '@shared/math/yield';
import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@shared/ui/HoverCard';
import { Metric } from '@shared/ui/Typography';
import { createMemo, type JSX, Show } from 'solid-js';
import type { MarketData } from '../model/types';

import { AssetTypeBadge } from './AssetTypeBadge';

/**
 * Stat row component for compact data display
 */
function StatRow(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="flex items-center justify-between gap-2 overflow-hidden">
      <span class="text-compact text-muted-foreground flex-shrink-0 text-xs">{props.label}</span>
      <span class="truncate text-right">{props.children}</span>
    </div>
  );
}

/**
 * Visual yield bar that scales with APY percentage
 */
function YieldBar(props: { apy: number }): JSX.Element {
  // Cap at 100% width, scale so 20% APY = 100% bar
  const width = createMemo(() => Math.min(props.apy * 5, 100));

  return (
    <div class="bg-muted h-1.5 overflow-hidden rounded-full">
      <div
        class="from-chart-1 to-primary h-full rounded-full bg-gradient-to-r transition-all duration-500"
        style={{ width: `${width()}%` }}
      />
    </div>
  );
}

/** Sparkles icon for recommended badge */
function SparklesIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      aria-hidden="true"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

/** Clock icon for expiry */
function ClockIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * ExpiryBadge component for showing time until expiry
 */
function ExpiryBadge(props: { expiryTimestamp: number }): JSX.Element {
  const days = createMemo(() => daysToExpiry(props.expiryTimestamp));
  const isExpired = createMemo(() => days() <= 0);

  const displayText = createMemo(() => {
    if (isExpired()) return 'Expired';
    const d = days();
    if (d < 1) {
      const hours = Math.floor(d * 24);
      return `${hours}h`;
    }
    if (d < 7) return `${Math.floor(d)}d`;
    if (d < 30) return `${Math.floor(d / 7)}w`;
    return `${Math.floor(d / 30)}mo`;
  });

  const variant = createMemo(() => {
    if (isExpired()) return 'destructive';
    const d = days();
    if (d < 3) return 'warning';
    if (d < 7) return 'warning';
    return 'secondary';
  });

  return (
    <HoverCard>
      <HoverCardTrigger>
        <Badge variant={variant()} class="gap-0.5 cursor-help">
          <ClockIcon class="h-3 w-3" />
          <span>{displayText()}</span>
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent class="w-48">
        <div class="space-y-1">
          <p class="text-sm font-medium">
            {isExpired() ? 'Market Expired' : `${Math.floor(days())} days remaining`}
          </p>
          <p class="text-muted-foreground text-xs">Expiry: {formatExpiry(props.expiryTimestamp)}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Format APY for display
 */
function formatApy(apy: number): string {
  const sign = apy >= 0 ? '+' : '';
  return `${sign}${apy.toFixed(1)}%`;
}

interface MarketCardProps {
  market: MarketData;
  /** Highlight this market as the recommended option (Paradox of Choice) */
  isRecommended?: boolean | undefined;
  class?: string | undefined;
  /** Called when trade button is clicked */
  onTrade?: ((marketAddress: string) => void) | undefined;
  /** Called when pool button is clicked */
  onPool?: ((marketAddress: string) => void) | undefined;
}

/**
 * MarketCard - Redesigned with visual hierarchy and yield indicators
 *
 * Features:
 * - Yield intensity glow that scales with APY
 * - Token icon placeholder
 * - APY hero display with gradient
 * - Visual yield bar
 * - Compact 2-column stats grid
 * - Hover effects and animations
 */
export function MarketCard(props: MarketCardProps): JSX.Element {
  const isRecommended = () => props.isRecommended ?? false;

  // Token naming derived from SY symbol
  const tokenSymbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Token');
  const tokenName = createMemo(() => props.market.metadata?.yieldTokenName ?? 'Unknown Market');

  // Calculate APY percentage for display and effects
  const apyPercent = createMemo(() => props.market.impliedApy.toNumber() * 100);

  // Glow intensity scales with APY (capped at 20% APY = max glow)
  const glowOpacity = createMemo(() => Math.min(apyPercent() / 20, 1));

  const handleTrade = () => {
    props.onTrade?.(props.market.address);
  };

  const handlePool = () => {
    props.onPool?.(props.market.address);
  };

  return (
    <Card
      class={cn(
        'group relative overflow-hidden',
        'transition-all duration-300',
        'hover:shadow-primary/5 hover:shadow-lg',
        'card-hover-glow',
        isRecommended() && 'ring-primary/30 ring-2',
        props.class
      )}
    >
      {/* Yield intensity glow overlay - stronger for higher APY */}
      <div
        class="from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br transition-all duration-500 group-hover:via-transparent"
        style={{ opacity: glowOpacity() }}
        aria-hidden="true"
      />

      <CardHeader class="relative pb-2">
        <div class="flex items-start justify-between gap-3">
          {/* Token info with icon */}
          <div class="min-w-0 flex-1 overflow-hidden">
            <CardTitle class="flex items-center gap-2">
              {/* Token icon placeholder */}
              <div class="bg-primary/10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
                <span class="text-primary font-mono text-xs">PT</span>
              </div>
              <div class="min-w-0 overflow-hidden">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="truncate text-base font-semibold">PT-{tokenSymbol()}</span>
                  <Show when={isRecommended()}>
                    <Badge
                      variant="default"
                      class="bg-primary text-primary-foreground gap-0.5 px-1.5 py-0 text-[10px]"
                    >
                      <SparklesIcon class="h-2.5 w-2.5" />
                      <span>Top</span>
                    </Badge>
                  </Show>
                  <AssetTypeBadge syAddress={props.market.syAddress} />
                  <ExpiryBadge expiryTimestamp={props.market.expiry} />
                </div>
                <p class="text-muted-foreground mt-0.5 truncate text-xs">{tokenName()}</p>
              </div>
            </CardTitle>
          </div>

          {/* APY Hero Display */}
          <HoverCard>
            <HoverCardTrigger class="flex-shrink-0 cursor-help text-right">
              <div class="flex items-center justify-end gap-1">
                <span class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  APY
                </span>
                <Show when={props.market.oracleState !== 'spot-only'}>
                  <Badge variant="success" class="h-4 px-1 text-[9px]">
                    TWAP
                  </Badge>
                </Show>
              </div>
              <div class="text-primary font-mono text-xl font-semibold tabular-nums">
                {formatApy(apyPercent())}
              </div>
              <Show when={props.market.oracleState !== 'spot-only'}>
                <div class="text-muted-foreground text-[10px]">
                  Current: {formatApy(props.market.spotImpliedApy.toNumber() * 100)}
                </div>
              </Show>
            </HoverCardTrigger>
            <HoverCardContent side="top" class="w-64">
              <div class="space-y-2">
                <div class="text-foreground text-sm font-medium">APY Details</div>
                <div class="space-y-1">
                  <div class="text-muted-foreground flex justify-between text-xs">
                    <span>TWAP Rate ({Math.round(props.market.twapDuration / 60)}m)</span>
                    <span class="font-medium">
                      {formatApy(props.market.twapImpliedApy.toNumber() * 100)}
                    </span>
                  </div>
                  <div class="text-muted-foreground flex justify-between text-xs">
                    <span>Spot Rate</span>
                    <span class="font-medium">
                      {formatApy(props.market.spotImpliedApy.toNumber() * 100)}
                    </span>
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </CardHeader>

      <CardContent class="relative">
        {/* Visual yield bar */}
        <div class="mb-4">
          <YieldBar apy={apyPercent()} />
        </div>

        {/* Compact stats grid - 2 columns */}
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <StatRow label="TVL">
            <Metric size="sm">{formatWadCompact(props.market.tvlSy)} SY</Metric>
          </StatRow>

          <StatRow label="Liquidity">
            <Metric size="sm">{formatWadCompact(props.market.state.syReserve)} SY</Metric>
          </StatRow>

          <StatRow label="Days Left">
            <Metric size="sm">
              {props.market.isExpired ? 'Expired' : Math.round(props.market.daysToExpiry)}
            </Metric>
          </StatRow>

          <StatRow label="Fee Rate">
            <Metric size="sm">{(props.market.annualFeeRate * 100).toFixed(2)}%</Metric>
          </StatRow>

          {/* Protocol Fees (only show if collected) */}
          <Show when={props.market.state.feesCollected > 0n}>
            <StatRow label="Fees">
              <Metric size="sm">{formatWadCompact(props.market.state.feesCollected)} SY</Metric>
            </StatRow>
          </Show>
        </div>

        {/* Action buttons with hover reveal */}
        <div class="mt-4 flex gap-2 opacity-80 transition-opacity group-hover:opacity-100">
          <Button variant="default" class="flex-1" onClick={handleTrade}>
            Trade PT
          </Button>
          <Button variant="outline" class="flex-1" onClick={handlePool}>
            Pool
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
