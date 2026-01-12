import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { formatExpiry } from '@shared/math/yield';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader } from '@shared/ui/Card';
import { createSignal, type JSX, Show } from 'solid-js';

import { formatPercent, formatUsd } from '../lib';
import type { EnhancedPosition } from '../model/types';

// ----- Types -----

export interface YieldEarnedData {
  totalClaimed: bigint;
  totalClaimedUsd: number;
  claimCount: number;
}

export interface YieldFeeInfo {
  feeRatePercent: string;
  hasFee: boolean;
}

export interface PostExpiryInfo {
  isInitialized: boolean;
  totalTreasuryInterestFormatted?: string;
}

interface EnhancedPositionCardProps {
  position: EnhancedPosition;
  yieldEarned?: YieldEarnedData | undefined;
  claimPreview?: JSX.Element | undefined;
  onClaimYield?: (() => void) | undefined;
  onRedeemPtYt?: (() => void) | undefined;
  onRedeemPt?: (() => void) | undefined;
  onUnwrapSy?: (() => void) | undefined;
  isClaimingYield?: boolean | undefined;
  isRedeeming?: boolean | undefined;
  isUnwrapping?: boolean | undefined;
  yieldFeeInfo?: YieldFeeInfo | undefined;
  postExpiryInfo?: PostExpiryInfo | undefined;
  /** Called when trade link is clicked */
  onTrade?: ((marketAddress: string) => void) | undefined;
  /** Called when manage LP link is clicked */
  onPool?: ((marketAddress: string) => void) | undefined;
}

// ----- Token Symbols Helper -----

interface TokenSymbols {
  tokenSymbol: string;
  tokenName: string;
  sySymbol: string;
  ptSymbol: string;
  ytSymbol: string;
}

function getTokenSymbols(position: EnhancedPosition): TokenSymbols {
  const { market } = position;
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'Unknown Market';
  return {
    tokenSymbol,
    tokenName,
    sySymbol: `SY-${tokenSymbol}`,
    ptSymbol: `PT-${tokenSymbol}`,
    ytSymbol: `YT-${tokenSymbol}`,
  };
}

// ----- SVG Icons -----

function ChevronDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ----- Status Badges Component -----

interface StatusBadgesProps {
  market: EnhancedPosition['market'];
  postExpiryInfo?: PostExpiryInfo | undefined;
  yieldFeeInfo?: YieldFeeInfo | undefined;
  isExpanded: boolean;
}

function ExpiryBadge(props: { market: EnhancedPosition['market']; postExpiryInfo?: PostExpiryInfo | undefined }): JSX.Element {
  return (
    <Show
      when={props.market.isExpired}
      fallback={
        <span class="bg-primary/20 text-primary rounded px-2 py-0.5 text-xs">
          {Math.max(0, props.market.daysToExpiry).toFixed(0)} days left
        </span>
      }
    >
      <span class="bg-destructive/20 text-destructive rounded px-2 py-0.5 text-xs">
        Expired
      </span>
      <Show when={props.postExpiryInfo?.isInitialized}>
        <span class="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
          Post-expiry active
        </span>
      </Show>
    </Show>
  );
}

function FeeBadge(props: { yieldFeeInfo?: YieldFeeInfo | undefined }): JSX.Element {
  return (
    <Show when={props.yieldFeeInfo?.hasFee}>
      <span class="bg-warning/20 text-warning rounded px-2 py-0.5 text-xs">
        {props.yieldFeeInfo?.feeRatePercent} fee
      </span>
    </Show>
  );
}

function StatusBadges(props: StatusBadgesProps): JSX.Element {
  return (
    <div class="mt-1 flex flex-wrap items-center justify-end gap-2">
      <ExpiryBadge market={props.market} postExpiryInfo={props.postExpiryInfo} />
      <FeeBadge yieldFeeInfo={props.yieldFeeInfo} />
      <ChevronDownIcon
        class={cn(
          'text-muted-foreground h-5 w-5 transition-transform',
          props.isExpanded && 'rotate-180'
        )}
      />
    </div>
  );
}

// ----- PnL Display Component -----

interface PnlDisplayProps {
  pnl: EnhancedPosition['pnl'];
  totalValueUsd: number;
}

function PnlDisplay(props: PnlDisplayProps): JSX.Element {
  const pnlColorClass = () => (props.pnl.unrealizedUsd >= 0 ? 'text-primary' : 'text-destructive');
  const pnlSign = () => (props.pnl.unrealizedUsd >= 0 ? '+' : '');

  return (
    <>
      <div class="text-foreground font-medium">{formatUsd(props.totalValueUsd)}</div>
      <Show when={props.pnl.unrealizedUsd !== 0}>
        <div class={cn('text-sm', pnlColorClass())}>
          {pnlSign()}
          {formatUsd(props.pnl.unrealizedUsd)}
          <span class="text-muted-foreground ml-1">({formatPercent(props.pnl.totalPnlPercent)})</span>
        </div>
      </Show>
    </>
  );
}

// ----- Token Balance Component -----

interface TokenBalanceProps {
  label: string;
  amount: bigint;
  valueUsd: number;
  subtitle?: string;
}

function TokenBalance(props: TokenBalanceProps): JSX.Element {
  return (
    <div class="bg-muted rounded-lg p-3">
      <div class="text-muted-foreground text-xs">{props.label}</div>
      <div class="text-foreground font-mono font-medium">{formatWadCompact(props.amount)}</div>
      <div class="text-muted-foreground text-xs">{formatUsd(props.valueUsd)}</div>
      <Show when={props.subtitle}>
        <div class="text-muted-foreground text-xs">{props.subtitle}</div>
      </Show>
    </div>
  );
}

// ----- Token Balances Grid Component -----

interface TokenBalancesGridProps {
  position: EnhancedPosition;
  symbols: TokenSymbols;
}

function TokenBalancesGrid(props: TokenBalancesGridProps): JSX.Element {
  const { sy, pt, yt, lp, lpDetails } = props.position;
  const { sySymbol, ptSymbol, ytSymbol, tokenSymbol } = props.symbols;

  return (
    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Show when={sy.amount > 0n}>
        <TokenBalance label={sySymbol} amount={sy.amount} valueUsd={sy.valueUsd} />
      </Show>
      <Show when={pt.amount > 0n}>
        <TokenBalance label={ptSymbol} amount={pt.amount} valueUsd={pt.valueUsd} />
      </Show>
      <Show when={yt.amount > 0n}>
        <TokenBalance label={ytSymbol} amount={yt.amount} valueUsd={yt.valueUsd} />
      </Show>
      <Show when={lp.amount > 0n}>
        <TokenBalance
          label={`LP-${tokenSymbol}`}
          amount={lp.amount}
          valueUsd={lp.valueUsd}
          subtitle={`${lpDetails.sharePercent.toFixed(2)}% of pool`}
        />
      </Show>
    </div>
  );
}

// ----- LP Composition Component -----

interface LpCompositionProps {
  lp: EnhancedPosition['lp'];
  lpDetails: EnhancedPosition['lpDetails'];
}

function LpComposition(props: LpCompositionProps): JSX.Element {
  return (
    <Show when={props.lp.amount > 0n}>
      <div class="bg-muted mb-4 rounded p-3">
        <div class="text-foreground mb-2 text-sm font-medium">LP Composition</div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-muted-foreground">SY:</span>{' '}
            <span class="text-foreground">{formatWadCompact(props.lpDetails.underlyingSy)}</span>
          </div>
          <div>
            <span class="text-muted-foreground">PT:</span>{' '}
            <span class="text-foreground">{formatWadCompact(props.lpDetails.underlyingPt)}</span>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ----- Claimable Yield Component -----

interface ClaimableYieldCardProps {
  yt: EnhancedPosition['yt'];
  yieldData: EnhancedPosition['yield'];
  sySymbol: string;
  yieldFeeInfo?: YieldFeeInfo | undefined;
  claimPreview?: JSX.Element | undefined;
  onClaimYield?: (() => void) | undefined;
  isClaimingYield?: boolean | undefined;
}

function ClaimableYieldCard(props: ClaimableYieldCardProps): JSX.Element {
  const buttonLabel = () => (props.isClaimingYield === true ? 'Claiming...' : 'Claim');

  return (
    <Show when={props.yt.amount > 0n && props.yieldData.claimable > 0n}>
      <div class="border-primary/30 bg-primary/10 mb-4 rounded border p-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-primary flex items-center gap-2 text-sm">
              Claimable Yield
              <Show when={props.yieldFeeInfo?.hasFee}>
                <span class="bg-warning/20 text-warning rounded px-1.5 py-0.5 text-xs">
                  {props.yieldFeeInfo?.feeRatePercent} fee applies
                </span>
              </Show>
            </div>
            <div class="text-primary font-medium">
              {formatWadCompact(props.yieldData.claimable)} {props.sySymbol}
              <span class="text-primary/80 ml-1 text-sm">
                ({formatUsd(props.yieldData.claimableUsd)})
              </span>
            </div>
            <Show when={props.yieldFeeInfo?.hasFee}>
              <p class="text-primary/70 mt-1 text-xs">
                Net amount after {props.yieldFeeInfo?.feeRatePercent} protocol fee
              </p>
            </Show>
            <Show when={props.claimPreview !== undefined}>
              <div class="mt-2">{props.claimPreview}</div>
            </Show>
          </div>
          <Button size="sm" onClick={props.onClaimYield} disabled={props.isClaimingYield === true}>
            {buttonLabel()}
          </Button>
        </div>
      </div>
    </Show>
  );
}

// ----- Yield Earned Component -----

interface YieldEarnedCardProps {
  yieldEarned?: YieldEarnedData | undefined;
  sySymbol: string;
}

function YieldEarnedCard(props: YieldEarnedCardProps): JSX.Element {
  const claimsLabel = () => (props.yieldEarned?.claimCount === 1 ? 'claim' : 'claims');

  return (
    <Show when={props.yieldEarned && props.yieldEarned.totalClaimed > 0n}>
      <div class="bg-muted mb-4 rounded p-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-muted-foreground text-sm">Yield Earned</div>
            <div class="text-foreground font-medium">
              {formatWadCompact(props.yieldEarned?.totalClaimed ?? 0n)} {props.sySymbol}
              <span class="text-muted-foreground ml-1 text-sm">
                ({formatUsd(props.yieldEarned?.totalClaimedUsd ?? 0)})
              </span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-muted-foreground text-xs">
              {props.yieldEarned?.claimCount ?? 0} {claimsLabel()}
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ----- Redemption Actions Component -----

interface RedemptionActionsProps {
  redemption: EnhancedPosition['redemption'];
  yieldData: EnhancedPosition['yield'];
  ptSymbol: string;
  ytSymbol: string;
  onRedeemPtYt?: (() => void) | undefined;
  onRedeemPt?: (() => void) | undefined;
  isRedeeming?: boolean | undefined;
}

function RedemptionActions(props: RedemptionActionsProps): JSX.Element {
  const redeemPtYtLabel = () =>
    props.yieldData.claimable > 0n ? 'Redeem + Claim' : `Redeem ${props.ptSymbol} + ${props.ytSymbol}`;

  return (
    <Show when={props.redemption.canRedeemPtYt || props.redemption.canRedeemPtPostExpiry}>
      <div class="mb-4 space-y-2">
        <Show when={props.redemption.canRedeemPtYt}>
          <Button
            variant="outline"
            size="sm"
            class="w-full"
            onClick={props.onRedeemPtYt}
            disabled={props.isRedeeming === true}
          >
            {redeemPtYtLabel()}
          </Button>
        </Show>
        <Show when={props.redemption.canRedeemPtPostExpiry}>
          <Button
            variant="outline"
            size="sm"
            class="w-full"
            onClick={props.onRedeemPt}
            disabled={props.isRedeeming === true}
          >
            Redeem Expired {props.ptSymbol}
          </Button>
        </Show>
      </div>
    </Show>
  );
}

// ----- Unwrap SY Component -----

interface UnwrapSyCardProps {
  sy: EnhancedPosition['sy'];
  market: EnhancedPosition['market'];
  sySymbol: string;
  onUnwrapSy?: (() => void) | undefined;
  isUnwrapping?: boolean | undefined;
}

function UnwrapSyCard(props: UnwrapSyCardProps): JSX.Element {
  const underlyingSymbol = () => props.market.metadata?.yieldTokenSymbol ?? 'underlying';
  const buttonLabel = () => (props.isUnwrapping === true ? 'Withdrawing...' : 'Withdraw');

  return (
    <Show when={props.sy.amount > 0n && props.onUnwrapSy}>
      <div class="border-chart-3/30 bg-chart-3/10 mb-4 rounded border p-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-chart-3 text-sm">Withdraw {props.sySymbol}</div>
            <div class="text-foreground font-medium">
              {formatWadCompact(props.sy.amount)} {props.sySymbol}
              <span class="text-muted-foreground ml-1 text-sm">({formatUsd(props.sy.valueUsd)})</span>
            </div>
            <p class="text-muted-foreground text-xs">Convert to {underlyingSymbol()}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={props.onUnwrapSy}
            disabled={props.isUnwrapping === true}
          >
            {buttonLabel()}
          </Button>
        </div>
      </div>
    </Show>
  );
}

// ----- Quick Actions Component -----

interface QuickActionsProps {
  marketAddress: string;
  onTrade?: ((marketAddress: string) => void) | undefined;
  onPool?: ((marketAddress: string) => void) | undefined;
}

function QuickActions(props: QuickActionsProps): JSX.Element {
  return (
    <div class="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        class="flex-1"
        onClick={() => props.onTrade?.(props.marketAddress)}
      >
        Trade
      </Button>
      <Button
        variant="secondary"
        size="sm"
        class="flex-1"
        onClick={() => props.onPool?.(props.marketAddress)}
      >
        Manage LP
      </Button>
    </div>
  );
}

// ----- Visibility Helper -----

function hasVisibleContent(position: EnhancedPosition): boolean {
  const { sy, pt, yt, lp, yield: yieldData } = position;
  const hasAnyBalance = sy.amount > 0n || pt.amount > 0n || yt.amount > 0n || lp.amount > 0n;
  return hasAnyBalance || yieldData.claimable > 0n;
}

// ----- Main Component -----

export function EnhancedPositionCard(props: EnhancedPositionCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const symbols = () => getTokenSymbols(props.position);

  // Don't render if no visible content
  const shouldRender = () => hasVisibleContent(props.position);

  return (
    <Show when={shouldRender()}>
      <Card class="border-border rounded-lg border">
        <button
          type="button"
          class="w-full cursor-pointer text-left"
          aria-expanded={isExpanded()}
          onClick={() => setIsExpanded(!isExpanded())}
        >
          <CardHeader class="p-4">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-foreground font-medium">{symbols().ptSymbol} Market</h3>
                <p class="text-muted-foreground text-sm">{symbols().tokenName}</p>
                <p class="text-muted-foreground text-xs">Expires {formatExpiry(props.position.market.expiry)}</p>
              </div>
              <div class="text-right">
                <PnlDisplay pnl={props.position.pnl} totalValueUsd={props.position.totalValueUsd} />
                <StatusBadges
                  market={props.position.market}
                  postExpiryInfo={props.postExpiryInfo}
                  yieldFeeInfo={props.yieldFeeInfo}
                  isExpanded={isExpanded()}
                />
              </div>
            </div>
          </CardHeader>
        </button>

        <CardContent class={cn('border-border border-t p-4', !isExpanded() && 'hidden')}>
          <TokenBalancesGrid position={props.position} symbols={symbols()} />
          <LpComposition lp={props.position.lp} lpDetails={props.position.lpDetails} />
          <ClaimableYieldCard
            yt={props.position.yt}
            yieldData={props.position.yield}
            sySymbol={symbols().sySymbol}
            yieldFeeInfo={props.yieldFeeInfo}
            claimPreview={props.claimPreview}
            onClaimYield={props.onClaimYield}
            isClaimingYield={props.isClaimingYield}
          />
          <YieldEarnedCard yieldEarned={props.yieldEarned} sySymbol={symbols().sySymbol} />
          <RedemptionActions
            redemption={props.position.redemption}
            yieldData={props.position.yield}
            ptSymbol={symbols().ptSymbol}
            ytSymbol={symbols().ytSymbol}
            onRedeemPtYt={props.onRedeemPtYt}
            onRedeemPt={props.onRedeemPt}
            isRedeeming={props.isRedeeming}
          />
          <UnwrapSyCard
            sy={props.position.sy}
            market={props.position.market}
            sySymbol={symbols().sySymbol}
            onUnwrapSy={props.onUnwrapSy}
            isUnwrapping={props.isUnwrapping}
          />
          <QuickActions
            marketAddress={props.position.market.address}
            onTrade={props.onTrade}
            onPool={props.onPool}
          />
        </CardContent>
      </Card>
    </Show>
  );
}
