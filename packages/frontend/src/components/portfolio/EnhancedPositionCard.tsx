'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { formatUsd, formatPercent } from '@/lib/position/value';
import type { EnhancedPosition } from '@/types/position';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { formatExpiry } from '@shared/math/yield';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader } from '@shared/ui/Card';

export interface YieldEarnedData {
  totalClaimed: bigint;
  totalClaimedUsd: number;
  claimCount: number;
}

interface EnhancedPositionCardProps {
  position: EnhancedPosition;
  yieldEarned?: YieldEarnedData | undefined;
  onClaimYield?: () => void;
  onRedeemPtYt?: () => void;
  onRedeemPt?: () => void;
  isClaimingYield?: boolean;
  isRedeeming?: boolean;
}

export function EnhancedPositionCard({
  position,
  yieldEarned,
  onClaimYield,
  onRedeemPtYt,
  onRedeemPt,
  isClaimingYield,
  isRedeeming,
}: EnhancedPositionCardProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  const { market, sy, pt, yt, lp, yield: yieldData, pnl, lpDetails, redemption } = position;

  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'Unknown Market';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;
  const ytSymbol = `YT-${tokenSymbol}`;

  const hasAnyBalance = sy.amount > 0n || pt.amount > 0n || yt.amount > 0n || lp.amount > 0n;

  if (!hasAnyBalance && yieldData.claimable === 0n) {
    return null;
  }

  return (
    <Card className="border-border rounded-lg border">
      {/* Header - Clickable to expand */}
      <button
        type="button"
        className="w-full cursor-pointer text-left"
        aria-expanded={isExpanded}
        onClick={(): void => {
          setIsExpanded(!isExpanded);
        }}
      >
        <CardHeader className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-foreground font-medium">{ptSymbol} Market</h3>
              <p className="text-muted-foreground text-sm">{tokenName}</p>
              <p className="text-muted-foreground text-xs">Expires {formatExpiry(market.expiry)}</p>
            </div>
            <div className="text-right">
              <div className="text-foreground font-medium">{formatUsd(position.totalValueUsd)}</div>
              {pnl.unrealizedUsd !== 0 && (
                <div
                  className={cn(
                    'text-sm',
                    pnl.unrealizedUsd >= 0 ? 'text-primary' : 'text-destructive'
                  )}
                >
                  {pnl.unrealizedUsd >= 0 ? '+' : ''}
                  {formatUsd(pnl.unrealizedUsd)}
                  <span className="text-muted-foreground ml-1">
                    ({formatPercent(pnl.totalPnlPercent)})
                  </span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-end gap-2">
                {market.isExpired ? (
                  <span className="bg-destructive/20 text-destructive rounded px-2 py-0.5 text-xs">
                    Expired
                  </span>
                ) : (
                  <span className="bg-primary/20 text-primary rounded px-2 py-0.5 text-xs">
                    {Math.max(0, market.daysToExpiry).toFixed(0)} days left
                  </span>
                )}
                <svg
                  className={cn(
                    'text-muted-foreground h-5 w-5 transition-transform',
                    isExpanded && 'rotate-180'
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Expandable Content */}
      <CardContent className={cn('border-border border-t p-4', !isExpanded && 'hidden')}>
        {/* Token Balances with USD values */}
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

        {/* LP Details */}
        {lp.amount > 0n && (
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
        )}

        {/* Claimable Yield */}
        {yt.amount > 0n && yieldData.claimable > 0n && (
          <div className="border-primary/30 bg-primary/10 mb-4 flex items-center justify-between rounded border p-3">
            <div>
              <div className="text-primary text-sm">Claimable Yield</div>
              <div className="text-primary font-medium">
                {formatWadCompact(yieldData.claimable)} {sySymbol}
                <span className="text-primary/80 ml-1 text-sm">
                  ({formatUsd(yieldData.claimableUsd)})
                </span>
              </div>
            </div>
            <Button
              nativeButton
              size="sm"
              onClick={onClaimYield}
              disabled={isClaimingYield === true}
            >
              {isClaimingYield === true ? 'Claiming...' : 'Claim'}
            </Button>
          </div>
        )}

        {/* Yield Earned (Historical) */}
        {yieldEarned && yieldEarned.totalClaimed > 0n && (
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
                  {yieldEarned.claimCount} {yieldEarned.claimCount === 1 ? 'claim' : 'claims'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Redemption Options */}
        {(redemption.canRedeemPtYt || redemption.canRedeemPtPostExpiry) && (
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
                Redeem {ptSymbol} + {ytSymbol}
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
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            nativeButton={false}
            render={<Link href={`/trade?market=${market.address}`} />}
          >
            Trade
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            nativeButton={false}
            render={<Link href={`/pools?market=${market.address}`} />}
          >
            Manage LP
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
