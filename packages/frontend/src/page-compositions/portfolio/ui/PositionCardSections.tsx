'use client';

import type { MarketPosition } from '@features/portfolio';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { TxStatus } from '@widgets/display/TxStatus';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { TokenSymbols, TxStatusValue } from '../lib/positionCardLogic';

// ============================================================================
// LP Position Section
// ============================================================================

interface LpPositionSectionProps {
  position: MarketPosition;
  symbols: TokenSymbols;
}

export function LpPositionSection({ position, symbols }: LpPositionSectionProps): ReactNode {
  if (position.lpBalance <= 0n) return null;

  return (
    <div className="border-chart-2/30 bg-chart-2/10 mb-4 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-chart-2 font-medium">LP Position</h4>
        <span className="text-muted-foreground text-sm">
          {position.lpSharePercent < 0.01 ? '< 0.01' : position.lpSharePercent.toFixed(2)}% of pool
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-background/50 rounded-lg p-3">
          <div className="text-muted-foreground text-xs">LP Tokens</div>
          <div className="text-foreground font-mono text-lg">
            {formatWadCompact(position.lpBalance)}
          </div>
        </div>
        <div className="bg-background/50 rounded-lg p-3">
          <div className="text-muted-foreground text-xs">Value in {symbols.sySymbol}</div>
          <div className="text-foreground font-mono text-lg">
            {formatWadCompact(position.lpValueSy)}
          </div>
        </div>
        <div className="bg-background/50 rounded-lg p-3">
          <div className="text-muted-foreground text-xs">Value in {symbols.ptSymbol}</div>
          <div className="text-foreground font-mono text-lg">
            {formatWadCompact(position.lpValuePt)}
          </div>
        </div>
      </div>
      <div className="bg-background/50 mt-3 rounded-lg p-3">
        <div className="text-chart-2 flex items-center gap-1.5 text-xs font-medium">
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          LP Rewards
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Swap fees are automatically compounded into your LP position, increasing your share of
          pool reserves over time.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Token Balances Section
// ============================================================================

interface TokenBalancesSectionProps {
  position: MarketPosition;
  symbols: TokenSymbols;
}

export function TokenBalancesSection({ position, symbols }: TokenBalancesSectionProps): ReactNode {
  return (
    <div className="space-y-2">
      <h4 className="text-foreground text-sm font-medium">Token Balances</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-muted rounded-lg p-3">
          <div className="text-muted-foreground">{symbols.sySymbol}</div>
          <div className="text-foreground font-mono">{formatWadCompact(position.syBalance)}</div>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <div className="text-muted-foreground">{symbols.ptSymbol}</div>
          <div className="text-foreground font-mono">{formatWadCompact(position.ptBalance)}</div>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <div className="text-muted-foreground">{symbols.ytSymbol}</div>
          <div className="text-foreground font-mono">{formatWadCompact(position.ytBalance)}</div>
        </div>
        {position.lpBalance === 0n && (
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground">LP-{symbols.tokenSymbol}</div>
            <div className="text-muted-foreground font-mono">0</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Claimable Yield Section
// ============================================================================

interface ClaimableYieldSectionProps {
  position: MarketPosition;
  symbols: TokenSymbols;
  onClaim: () => void;
  isClaiming: boolean;
  claimSuccess: boolean;
  txStatus: TxStatusValue;
  txHash: string | null;
  error: Error | null;
}

export function ClaimableYieldSection({
  position,
  symbols,
  onClaim,
  isClaiming,
  claimSuccess,
  txStatus,
  txHash,
  error,
}: ClaimableYieldSectionProps): ReactNode {
  if (position.claimableYield <= 0n) return null;

  return (
    <div className="border-primary/30 bg-primary/10 mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-primary flex items-center gap-1.5 text-sm">
            <span className="bg-primary/30 rounded px-1.5 py-0.5 text-xs font-medium">YT</span>
            Accrued Yield
          </div>
          <div className="text-primary font-mono text-lg">
            {formatWad(position.claimableYield, 6)} {symbols.sySymbol}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Interest earned from holding {symbols.ytSymbol}
          </p>
        </div>
        <Button onClick={onClaim} disabled={isClaiming || claimSuccess} size="sm">
          {isClaiming ? 'Claiming...' : claimSuccess ? 'Claimed!' : 'Claim'}
        </Button>
      </div>
      {txStatus !== 'idle' && (
        <div className="mt-2">
          <TxStatus status={txStatus} txHash={txHash} error={error} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Redemption Options Section
// ============================================================================

interface RedemptionSectionProps {
  position: MarketPosition;
  symbols: TokenSymbols;
  // PT+YT redemption
  onRedeemPy: () => void;
  isRedeemingPy: boolean;
  redeemPySuccess: boolean;
  redeemPyTxStatus: TxStatusValue;
  redeemPyTxHash: string | null;
  redeemPyError: Error | null;
  // PT post-expiry redemption
  onRedeemPt: () => void;
  isRedeemingPt: boolean;
  redeemPtSuccess: boolean;
  redeemPtTxStatus: TxStatusValue;
  redeemPtTxHash: string | null;
  redeemPtError: Error | null;
}

export function RedemptionSection({
  position,
  symbols,
  onRedeemPy,
  isRedeemingPy,
  redeemPySuccess,
  redeemPyTxStatus,
  redeemPyTxHash,
  redeemPyError,
  onRedeemPt,
  isRedeemingPt,
  redeemPtSuccess,
  redeemPtTxStatus,
  redeemPtTxHash,
  redeemPtError,
}: RedemptionSectionProps): ReactNode {
  if (!position.canRedeemPtYt && !position.canRedeemPtPostExpiry) return null;

  const redeemableAmount =
    position.ptBalance < position.ytBalance ? position.ptBalance : position.ytBalance;

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-foreground text-sm font-medium">Redemption Options</h4>

      {/* Redeem PT + YT (before expiry) */}
      {position.canRedeemPtYt && (
        <div className="border-secondary/30 bg-secondary/10 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-muted-foreground text-sm">
                Redeem {symbols.ptSymbol} + {symbols.ytSymbol}
              </div>
              <div className="text-muted-foreground text-xs">
                Burn matching {symbols.ptSymbol} & {symbols.ytSymbol} to receive {symbols.sySymbol}
              </div>
              <div className="text-foreground mt-1 font-mono text-sm">
                Max: {formatWad(redeemableAmount, 4)} {symbols.ptSymbol}+{symbols.ytSymbol}
              </div>
            </div>
            <Button
              onClick={onRedeemPy}
              disabled={isRedeemingPy || redeemPySuccess}
              size="sm"
              variant="secondary"
            >
              {isRedeemingPy ? 'Redeeming...' : redeemPySuccess ? 'Redeemed!' : 'Redeem'}
            </Button>
          </div>
          {redeemPyTxStatus !== 'idle' && (
            <div className="mt-2">
              <TxStatus status={redeemPyTxStatus} txHash={redeemPyTxHash} error={redeemPyError} />
            </div>
          )}
        </div>
      )}

      {/* Redeem PT post expiry */}
      {position.canRedeemPtPostExpiry && (
        <div className="border-chart-1/30 bg-chart-1/10 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-chart-1 text-sm">Redeem Expired {symbols.ptSymbol}</div>
              <div className="text-muted-foreground text-xs">
                Redeem {symbols.ptSymbol} for {symbols.sySymbol}
              </div>
              <div className="text-chart-1 mt-1 font-mono text-sm">
                {formatWad(position.ptBalance, 4)} {symbols.ptSymbol} → {symbols.sySymbol}
              </div>
            </div>
            <Button
              onClick={onRedeemPt}
              disabled={isRedeemingPt || redeemPtSuccess}
              size="sm"
              variant="secondary"
            >
              {isRedeemingPt ? 'Redeeming...' : redeemPtSuccess ? 'Redeemed!' : 'Redeem'}
            </Button>
          </div>
          {redeemPtTxStatus !== 'idle' && (
            <div className="mt-2">
              <TxStatus status={redeemPtTxStatus} txHash={redeemPtTxHash} error={redeemPtError} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Unwrap SY Section
// ============================================================================

interface UnwrapSectionProps {
  position: MarketPosition;
  symbols: TokenSymbols;
  canUnwrap: boolean;
  onUnwrap: () => void;
  isUnwrapping: boolean;
  unwrapSuccess: boolean;
  txStatus: TxStatusValue;
  txHash: string | null;
  error: Error | null;
}

export function UnwrapSection({
  position,
  symbols,
  canUnwrap,
  onUnwrap,
  isUnwrapping,
  unwrapSuccess,
  txStatus,
  txHash,
  error,
}: UnwrapSectionProps): ReactNode {
  if (!canUnwrap) return null;

  return (
    <div className="mt-4">
      <h4 className="text-foreground mb-3 text-sm font-medium">Withdraw</h4>
      <div className="border-chart-3/30 bg-chart-3/10 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-chart-3 text-sm">Withdraw {symbols.sySymbol}</div>
            <div className="text-muted-foreground text-xs">
              Convert {symbols.sySymbol} to {symbols.tokenSymbol}
            </div>
            <div className="text-foreground mt-1 font-mono text-sm">
              {formatWad(position.syBalance, 4)} {symbols.sySymbol} → {symbols.tokenSymbol}
            </div>
          </div>
          <Button
            onClick={onUnwrap}
            disabled={isUnwrapping || unwrapSuccess}
            size="sm"
            variant="secondary"
          >
            {isUnwrapping ? 'Withdrawing...' : unwrapSuccess ? 'Withdrawn!' : 'Withdraw'}
          </Button>
        </div>
        {txStatus !== 'idle' && (
          <div className="mt-2">
            <TxStatus status={txStatus} txHash={txHash} error={error} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Actions Section
// ============================================================================

interface QuickActionsSectionProps {
  marketAddress: string;
}

export function QuickActionsSection({ marketAddress }: QuickActionsSectionProps): ReactNode {
  return (
    <div className="mt-4 flex gap-2">
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

// ============================================================================
// Position Card Header
// ============================================================================

interface PositionCardHeaderProps {
  symbols: TokenSymbols;
  isExpired: boolean;
  daysToExpiry: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function PositionCardHeader({
  symbols,
  isExpired,
  daysToExpiry,
  isExpanded,
  onToggle,
}: PositionCardHeaderProps): ReactNode {
  return (
    <button type="button" className="w-full cursor-pointer text-left" onClick={onToggle}>
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{symbols.ptSymbol} Market</h3>
            <p className="text-muted-foreground text-sm">{symbols.tokenName}</p>
          </div>
          <div className="flex items-center gap-2">
            {isExpired ? (
              <span className="bg-destructive/20 text-destructive rounded px-2 py-0.5 text-xs">
                Expired
              </span>
            ) : (
              <span className="bg-primary/20 text-primary rounded px-2 py-0.5 text-xs">
                {daysToExpiry.toFixed(0)} days left
              </span>
            )}
            <ChevronIcon isExpanded={isExpanded} />
          </div>
        </div>
      </div>
    </button>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }): ReactNode {
  return (
    <svg
      className={`text-muted-foreground size-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
