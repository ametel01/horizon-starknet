'use client';

import type { TxStatus as TxStatusType } from '@shared/hooks/useTransaction';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { formatExpiry } from '@shared/math/yield';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader } from '@shared/ui/Card';
import { TxStatus } from '@widgets/display/TxStatus';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

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
  claimPreview?: ReactNode | undefined;
  onClaimYield?: (() => void) | undefined;
  onRedeemPtYt?: (() => void) | undefined;
  onRedeemPt?: (() => void) | undefined;
  onUnwrapSy?: (() => void) | undefined;
  isClaimingYield?: boolean | undefined;
  isRedeeming?: boolean | undefined;
  isUnwrapping?: boolean | undefined;
  unwrapTxStatus?: TxStatusType | undefined;
  unwrapTxHash?: string | null | undefined;
  unwrapError?: Error | null | undefined;
  yieldFeeInfo?: YieldFeeInfo | undefined;
  postExpiryInfo?: PostExpiryInfo | undefined;
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

// ----- Status Badges Component -----

interface StatusBadgesProps {
  market: EnhancedPosition['market'];
  postExpiryInfo?: PostExpiryInfo | undefined;
  yieldFeeInfo?: YieldFeeInfo | undefined;
  isExpanded: boolean;
}

function ExpiryBadge({ market, postExpiryInfo }: StatusBadgesProps): ReactNode {
  if (market.isExpired) {
    return (
      <>
        <span className="bg-destructive/20 text-destructive rounded px-2 py-0.5 text-xs">
          Expired
        </span>
        {postExpiryInfo?.isInitialized && (
          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
            Post-expiry active
          </span>
        )}
      </>
    );
  }

  return (
    <span className="bg-primary/20 text-primary rounded px-2 py-0.5 text-xs">
      {Math.max(0, market.daysToExpiry).toFixed(0)} days left
    </span>
  );
}

function FeeBadge({ yieldFeeInfo }: { yieldFeeInfo?: YieldFeeInfo | undefined }): ReactNode {
  if (!yieldFeeInfo?.hasFee) return null;

  return (
    <span className="bg-warning/20 text-warning rounded px-2 py-0.5 text-xs">
      {yieldFeeInfo.feeRatePercent} fee
    </span>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }): ReactNode {
  return (
    <svg
      className={cn(
        'text-muted-foreground h-5 w-5 transition-transform',
        isExpanded && 'rotate-180'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function StatusBadges(props: StatusBadgesProps): ReactNode {
  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
      <ExpiryBadge {...props} />
      <FeeBadge yieldFeeInfo={props.yieldFeeInfo} />
      <ChevronIcon isExpanded={props.isExpanded} />
    </div>
  );
}

// ----- PnL Display Component -----

interface PnlDisplayProps {
  pnl: EnhancedPosition['pnl'];
  totalValueUsd: number;
}

function PnlDisplay({ pnl, totalValueUsd }: PnlDisplayProps): ReactNode {
  const pnlColorClass = pnl.unrealizedUsd >= 0 ? 'text-primary' : 'text-destructive';
  const pnlSign = pnl.unrealizedUsd >= 0 ? '+' : '';

  return (
    <>
      <div className="text-foreground font-medium">{formatUsd(totalValueUsd)}</div>
      {pnl.unrealizedUsd !== 0 && (
        <div className={cn('text-sm', pnlColorClass)}>
          {pnlSign}
          {formatUsd(pnl.unrealizedUsd)}
          <span className="text-muted-foreground ml-1">({formatPercent(pnl.totalPnlPercent)})</span>
        </div>
      )}
    </>
  );
}

// ----- Token Balances Grid Component -----

interface TokenBalancesGridProps {
  position: EnhancedPosition;
  symbols: TokenSymbols;
}

function TokenBalancesGrid({ position, symbols }: TokenBalancesGridProps): ReactNode {
  const { sy, pt, yt, lp, lpDetails } = position;
  const { sySymbol, ptSymbol, ytSymbol, tokenSymbol } = symbols;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {sy.amount > 0n && (
        <TokenBalance label={sySymbol} amount={sy.amount} valueUsd={sy.valueUsd} />
      )}
      {pt.amount > 0n && (
        <TokenBalance label={ptSymbol} amount={pt.amount} valueUsd={pt.valueUsd} />
      )}
      {yt.amount > 0n && (
        <TokenBalance label={ytSymbol} amount={yt.amount} valueUsd={yt.valueUsd} />
      )}
      {lp.amount > 0n && (
        <TokenBalance
          label={`LP-${tokenSymbol}`}
          amount={lp.amount}
          valueUsd={lp.valueUsd}
          subtitle={`${lpDetails.sharePercent.toFixed(2)}% of pool`}
        />
      )}
    </div>
  );
}

// ----- LP Composition Component -----

interface LpCompositionProps {
  lp: EnhancedPosition['lp'];
  lpDetails: EnhancedPosition['lpDetails'];
}

function LpComposition({ lp, lpDetails }: LpCompositionProps): ReactNode {
  if (lp.amount === 0n) return null;

  return (
    <div className="bg-muted mb-4 rounded p-3">
      <div className="text-foreground mb-2 text-sm font-medium">LP Composition</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">SY:</span>{' '}
          <span className="text-foreground">{formatWadCompact(lpDetails.underlyingSy)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">PT:</span>{' '}
          <span className="text-foreground">{formatWadCompact(lpDetails.underlyingPt)}</span>
        </div>
      </div>
    </div>
  );
}

// ----- Claimable Yield Component -----

interface ClaimableYieldCardProps {
  yt: EnhancedPosition['yt'];
  yieldData: EnhancedPosition['yield'];
  sySymbol: string;
  yieldFeeInfo?: YieldFeeInfo | undefined;
  claimPreview?: ReactNode | undefined;
  onClaimYield?: (() => void) | undefined;
  isClaimingYield?: boolean | undefined;
}

function ClaimableYieldCard({
  yt,
  yieldData,
  sySymbol,
  yieldFeeInfo,
  claimPreview,
  onClaimYield,
  isClaimingYield,
}: ClaimableYieldCardProps): ReactNode {
  if (yt.amount === 0n || yieldData.claimable === 0n) return null;

  const buttonLabel = isClaimingYield === true ? 'Claiming...' : 'Claim';

  return (
    <div className="border-primary/30 bg-primary/10 mb-4 rounded border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-primary flex items-center gap-2 text-sm">
            Claimable Yield
            {yieldFeeInfo?.hasFee && (
              <span className="bg-warning/20 text-warning rounded px-1.5 py-0.5 text-xs">
                {yieldFeeInfo.feeRatePercent} fee applies
              </span>
            )}
          </div>
          <div className="text-primary font-medium">
            {formatWadCompact(yieldData.claimable)} {sySymbol}
            <span className="text-primary/80 ml-1 text-sm">
              ({formatUsd(yieldData.claimableUsd)})
            </span>
          </div>
          {yieldFeeInfo?.hasFee && (
            <p className="text-primary/70 mt-1 text-xs">
              Net amount after {yieldFeeInfo.feeRatePercent} protocol fee
            </p>
          )}
          {claimPreview !== null && <div className="mt-2">{claimPreview}</div>}
        </div>
        <Button nativeButton size="sm" onClick={onClaimYield} disabled={isClaimingYield === true}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

// ----- Yield Earned Component -----

interface YieldEarnedCardProps {
  yieldEarned?: YieldEarnedData | undefined;
  sySymbol: string;
}

function YieldEarnedCard({ yieldEarned, sySymbol }: YieldEarnedCardProps): ReactNode {
  if (!yieldEarned || yieldEarned.totalClaimed === 0n) return null;

  const claimsLabel = yieldEarned.claimCount === 1 ? 'claim' : 'claims';

  return (
    <div className="bg-muted mb-4 rounded p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-muted-foreground text-sm">Yield Earned</div>
          <div className="text-foreground font-medium">
            {formatWadCompact(yieldEarned.totalClaimed)} {sySymbol}
            <span className="text-muted-foreground ml-1 text-sm">
              ({formatUsd(yieldEarned.totalClaimedUsd)})
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs">
            {yieldEarned.claimCount} {claimsLabel}
          </div>
        </div>
      </div>
    </div>
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

function RedemptionActions({
  redemption,
  yieldData,
  ptSymbol,
  ytSymbol,
  onRedeemPtYt,
  onRedeemPt,
  isRedeeming,
}: RedemptionActionsProps): ReactNode {
  if (!redemption.canRedeemPtYt && !redemption.canRedeemPtPostExpiry) return null;

  const redeemPtYtLabel =
    yieldData.claimable > 0n ? 'Redeem + Claim' : `Redeem ${ptSymbol} + ${ytSymbol}`;

  return (
    <div className="mb-4 space-y-2">
      {redemption.canRedeemPtYt && (
        <Button
          nativeButton
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onRedeemPtYt}
          disabled={isRedeeming === true}
        >
          {redeemPtYtLabel}
        </Button>
      )}
      {redemption.canRedeemPtPostExpiry && (
        <Button
          nativeButton
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onRedeemPt}
          disabled={isRedeeming === true}
        >
          Redeem Expired {ptSymbol}
        </Button>
      )}
    </div>
  );
}

// ----- Unwrap SY Component -----

interface UnwrapSyCardProps {
  sy: EnhancedPosition['sy'];
  market: EnhancedPosition['market'];
  sySymbol: string;
  onUnwrapSy?: (() => void) | undefined;
  isUnwrapping?: boolean | undefined;
  unwrapTxStatus?: TxStatusType | undefined;
  unwrapTxHash?: string | null | undefined;
  unwrapError?: Error | null | undefined;
}

function UnwrapSyCard({
  sy,
  market,
  sySymbol,
  onUnwrapSy,
  isUnwrapping,
  unwrapTxStatus,
  unwrapTxHash,
  unwrapError,
}: UnwrapSyCardProps): ReactNode {
  if (sy.amount === 0n || !onUnwrapSy) return null;

  const underlyingSymbol = market.metadata?.yieldTokenSymbol ?? 'underlying';
  const buttonLabel = isUnwrapping === true ? 'Withdrawing...' : 'Withdraw';
  const showTxStatus = unwrapTxStatus && unwrapTxStatus !== 'idle';

  return (
    <div className="border-chart-3/30 bg-chart-3/10 mb-4 rounded border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-chart-3 text-sm">Withdraw {sySymbol}</div>
          <div className="text-foreground font-medium">
            {formatWadCompact(sy.amount)} {sySymbol}
            <span className="text-muted-foreground ml-1 text-sm">({formatUsd(sy.valueUsd)})</span>
          </div>
          <p className="text-muted-foreground text-xs">Convert to {underlyingSymbol}</p>
        </div>
        <Button
          nativeButton
          size="sm"
          variant="secondary"
          onClick={onUnwrapSy}
          disabled={isUnwrapping === true}
        >
          {buttonLabel}
        </Button>
      </div>
      {showTxStatus && (
        <div className="mt-2">
          <TxStatus
            status={unwrapTxStatus}
            txHash={unwrapTxHash ?? null}
            error={unwrapError ?? null}
          />
        </div>
      )}
    </div>
  );
}

// ----- Quick Actions Component -----

interface QuickActionsProps {
  marketAddress: string;
}

function QuickActions({ marketAddress }: QuickActionsProps): ReactNode {
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        nativeButton={false}
        render={<Link href={`/trade?market=${marketAddress}`} />}
      >
        Trade
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        nativeButton={false}
        render={<Link href={`/pools?market=${marketAddress}`} />}
      >
        Manage LP
      </Button>
    </div>
  );
}

// ----- Token Balance Component -----

interface TokenBalanceProps {
  label: string;
  amount: bigint;
  valueUsd: number;
  subtitle?: string;
}

function TokenBalance({ label, amount, valueUsd, subtitle }: TokenBalanceProps): ReactNode {
  return (
    <div className="bg-muted rounded-lg p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-foreground font-mono font-medium">{formatWadCompact(amount)}</div>
      <div className="text-muted-foreground text-xs">{formatUsd(valueUsd)}</div>
      {subtitle && <div className="text-muted-foreground text-xs">{subtitle}</div>}
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

export function EnhancedPositionCard({
  position,
  yieldEarned,
  claimPreview,
  onClaimYield,
  onRedeemPtYt,
  onRedeemPt,
  onUnwrapSy,
  isClaimingYield,
  isRedeeming,
  isUnwrapping,
  unwrapTxStatus,
  unwrapTxHash,
  unwrapError,
  yieldFeeInfo,
  postExpiryInfo,
}: EnhancedPositionCardProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  const { market, sy, yt, lp, yield: yieldData, pnl, lpDetails, redemption } = position;
  const symbols = getTokenSymbols(position);

  if (!hasVisibleContent(position)) {
    return null;
  }

  return (
    <Card className="border-border rounded-lg border">
      <button
        type="button"
        className="w-full cursor-pointer text-left"
        aria-expanded={isExpanded}
        onClick={(): void => setIsExpanded(!isExpanded)}
      >
        <CardHeader className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-foreground font-medium">{symbols.ptSymbol} Market</h3>
              <p className="text-muted-foreground text-sm">{symbols.tokenName}</p>
              <p className="text-muted-foreground text-xs">Expires {formatExpiry(market.expiry)}</p>
            </div>
            <div className="text-right">
              <PnlDisplay pnl={pnl} totalValueUsd={position.totalValueUsd} />
              <StatusBadges
                market={market}
                postExpiryInfo={postExpiryInfo}
                yieldFeeInfo={yieldFeeInfo}
                isExpanded={isExpanded}
              />
            </div>
          </div>
        </CardHeader>
      </button>

      <CardContent className={cn('border-border border-t p-4', !isExpanded && 'hidden')}>
        <TokenBalancesGrid position={position} symbols={symbols} />
        <LpComposition lp={lp} lpDetails={lpDetails} />
        <ClaimableYieldCard
          yt={yt}
          yieldData={yieldData}
          sySymbol={symbols.sySymbol}
          yieldFeeInfo={yieldFeeInfo}
          claimPreview={claimPreview}
          onClaimYield={onClaimYield}
          isClaimingYield={isClaimingYield}
        />
        <YieldEarnedCard yieldEarned={yieldEarned} sySymbol={symbols.sySymbol} />
        <RedemptionActions
          redemption={redemption}
          yieldData={yieldData}
          ptSymbol={symbols.ptSymbol}
          ytSymbol={symbols.ytSymbol}
          onRedeemPtYt={onRedeemPtYt}
          onRedeemPt={onRedeemPt}
          isRedeeming={isRedeeming}
        />
        <UnwrapSyCard
          sy={sy}
          market={market}
          sySymbol={symbols.sySymbol}
          onUnwrapSy={onUnwrapSy}
          isUnwrapping={isUnwrapping}
          unwrapTxStatus={unwrapTxStatus}
          unwrapTxHash={unwrapTxHash}
          unwrapError={unwrapError}
        />
        <QuickActions marketAddress={market.address} />
      </CardContent>
    </Card>
  );
}
