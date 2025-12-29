'use client';

import { AlertTriangleIcon, Wallet, Zap } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';

import type { MarketData } from '@entities/market';
import type { EnhancedPosition } from '@entities/position';
import { formatUsd } from '@entities/position/lib';
import { useSimpleWithdraw } from '@features/earn';
import { useEnhancedPositions, YieldExpiryAlert } from '@features/portfolio';
import { useAccount } from '@features/wallet';
import { ClaimValueWarning, useClaimYield } from '@features/yield';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { daysToExpiry, formatExpiry } from '@shared/math/yield';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import { BentoCard, BentoGrid } from '@shared/ui/BentoCard';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import { TxStatus } from '@widgets/display/TxStatus';

interface SimplePortfolioProps {
  markets: MarketData[];
}

/**
 * Simplified portfolio view for simple mode.
 * Shows positions as "Fixed-Rate" and "Variable-Rate" without SY/PT/YT terminology.
 * Hides LP positions (advanced feature).
 */
export function SimplePortfolio({ markets }: SimplePortfolioProps): ReactNode {
  const { isConnected } = useAccount();
  const { data: portfolio, isLoading } = useEnhancedPositions(markets);

  if (!isConnected) {
    return (
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Wallet className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">Connect your wallet</h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          Connect your wallet to view your yield positions and earnings.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid auto-rows-[minmax(120px,auto)] grid-cols-12 gap-4">
          <Skeleton className="col-span-12 h-[120px] rounded-xl md:col-span-4" />
          <Skeleton className="col-span-6 h-[120px] rounded-xl md:col-span-4" />
          <Skeleton className="col-span-6 h-[120px] rounded-xl md:col-span-4" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  // Filter positions to only show those with PT or YT (ignore LP-only)
  const activePositions =
    portfolio?.positions.filter((p) => p.pt.amount > 0n || p.yt.amount > 0n) ?? [];

  const hasPositions = activePositions.length > 0;

  // Calculate simple totals (exclude LP)
  const totalValue = activePositions.reduce((sum, p) => sum + p.pt.valueUsd + p.yt.valueUsd, 0);

  const totalClaimable = portfolio?.totalClaimableUsd ?? 0;

  return (
    <div className="space-y-8">
      {/* Summary Bento Grid */}
      <BentoGrid>
        {/* Total Value - Hero card */}
        <BentoCard colSpan={{ default: 12, md: 4 }} rowSpan={1} featured animationDelay={0}>
          <div className="flex h-full flex-col justify-center p-4">
            <div className="flex items-center gap-2">
              <Wallet className="text-primary h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Total Value
              </span>
            </div>
            <span className="text-foreground mt-2 font-mono text-3xl font-semibold">
              <AnimatedNumber value={totalValue} formatter={formatUsd} duration={600} />
            </span>
          </div>
        </BentoCard>

        {/* Active Positions */}
        <BentoCard colSpan={{ default: 6, md: 4 }} rowSpan={1} animationDelay={50}>
          <div className="flex h-full flex-col justify-center p-4">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Active Positions
            </span>
            <span className="text-foreground mt-2 font-mono text-3xl font-semibold">
              {activePositions.length}
            </span>
          </div>
        </BentoCard>

        {/* Claimable Yield */}
        <BentoCard colSpan={{ default: 6, md: 4 }} rowSpan={1} animationDelay={100}>
          <div className="flex h-full flex-col justify-center p-4">
            <div className="flex items-center gap-2">
              <Zap className="text-primary h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Claimable Yield
              </span>
            </div>
            <span className="text-primary mt-2 font-mono text-3xl font-semibold">
              <AnimatedNumber value={totalClaimable} formatter={formatUsd} duration={600} />
            </span>
          </div>
        </BentoCard>
      </BentoGrid>

      {/* Portfolio-level expiry warning */}
      {activePositions.some(
        (p) => daysToExpiry(p.market.expiry) <= 7 && p.yield.claimable > 0n && !p.market.isExpired
      ) && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle>Yield expiring soon</AlertTitle>
          <AlertDescription>
            You have positions with yield that will expire soon. Claim your yield before expiry to
            avoid loss.
          </AlertDescription>
        </Alert>
      )}

      {/* Positions List */}
      {hasPositions ? (
        <section className="space-y-4">
          <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
            Your Positions
          </h2>
          {activePositions.map((position) => (
            <SimplePositionCard key={position.market.address} position={position} />
          ))}
        </section>
      ) : (
        <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
          <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Wallet className="text-muted-foreground h-8 w-8" />
          </div>
          <h3 className="text-foreground text-lg font-semibold">No positions yet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Start earning fixed yield by depositing your tokens.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} render={<Link href="/mint" />}>
              Start Earning
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SimplePositionCardProps {
  position: EnhancedPosition;
}

/**
 * Simplified position card showing deposit info without technical terminology
 */
function SimplePositionCard({ position }: SimplePositionCardProps): ReactNode {
  const { market, pt, yt, yield: yieldData } = position;
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'Unknown';
  const underlyingAddress = market.metadata?.underlyingAddress ?? '';
  const maturityDate = formatExpiry(market.expiry);
  const fixedApy = market.impliedApy.toNumber() * 100;

  // Min of PT and YT for withdrawal (pre-expiry) or just PT (post-expiry)
  const withdrawableAmount = market.isExpired
    ? pt.amount
    : pt.amount < yt.amount
      ? pt.amount
      : yt.amount;

  // Withdraw hook
  const {
    withdraw,
    status: withdrawStatus,
    txHash: withdrawTxHash,
    error: withdrawError,
    isLoading: withdrawLoading,
    reset: resetWithdraw,
  } = useSimpleWithdraw({
    underlyingAddress,
    syAddress: market.syAddress,
    ptAddress: market.ptAddress,
    ytAddress: market.ytAddress,
    isExpired: market.isExpired,
  });

  // Claim yield hook
  const {
    claimYield,
    isClaiming,
    isSuccess: claimSuccess,
    transactionHash: claimTxHash,
    error: claimError,
    reset: resetClaim,
  } = useClaimYield();

  const handleWithdraw = useCallback(async () => {
    if (withdrawableAmount === BigInt(0)) return;
    setIsWithdrawing(true);
    await withdraw(withdrawableAmount);
    setIsWithdrawing(false);
  }, [withdraw, withdrawableAmount]);

  const handleClaim = useCallback(() => {
    claimYield({ ytAddress: market.ytAddress });
  }, [claimYield, market.ytAddress]);

  const handleReset = useCallback(() => {
    resetWithdraw();
    resetClaim();
  }, [resetWithdraw, resetClaim]);

  const totalValue = pt.valueUsd + yt.valueUsd;
  const hasClaimableYield = yieldData.claimable > 0n;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-foreground font-medium">{tokenName}</h3>
            <p className="text-muted-foreground text-sm">
              {market.isExpired ? 'Matured' : `Matures ${maturityDate}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-foreground font-medium">{formatUsd(totalValue)}</div>
            <div
              className={cn('text-sm', market.isExpired ? 'text-muted-foreground' : 'text-primary')}
            >
              {market.isExpired ? 'Ready to withdraw' : `${fixedApy.toFixed(2)}% Fixed`}
            </div>
          </div>
        </div>

        {/* Position Details */}
        <div className="bg-muted mb-4 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Fixed-Rate Position</span>
              <div className="text-foreground font-mono">{formatWadCompact(pt.amount)}</div>
              <div className="text-muted-foreground text-xs">{formatUsd(pt.valueUsd)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Variable-Rate Position</span>
              <div className="text-foreground font-mono">{formatWadCompact(yt.amount)}</div>
              <div className="text-muted-foreground text-xs">{formatUsd(yt.valueUsd)}</div>
            </div>
          </div>
        </div>

        {/* YT Expiry Alert (near-expiry with claimable yield) */}
        {hasClaimableYield && daysToExpiry(market.expiry) <= 7 && !market.isExpired && (
          <YieldExpiryAlert
            expiryTimestamp={market.expiry}
            claimableAmount={yieldData.claimable}
            claimableUsd={yieldData.claimableUsd}
            tokenSymbol={tokenSymbol}
            onClaim={handleClaim}
            isClaiming={isClaiming}
          />
        )}

        {/* Standard Claimable Yield (not near expiry or already expired) */}
        {hasClaimableYield && (daysToExpiry(market.expiry) > 7 || market.isExpired) && (
          <div className="border-primary/30 bg-primary/10 mb-4 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-primary text-sm">Claimable Yield</div>
                <div className="text-primary font-medium">
                  {formatWadCompact(yieldData.claimable)} {tokenSymbol}
                </div>
              </div>
              <Button size="sm" variant="default" onClick={handleClaim} disabled={isClaiming}>
                {isClaiming ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
            {/* Gas cost warning for small claims */}
            <ClaimValueWarning ytAddress={market.ytAddress} claimableUsd={yieldData.claimableUsd} />
          </div>
        )}

        {/* Claim Status */}
        {(claimSuccess || claimError) && (
          <div className="mb-4">
            <TxStatus
              status={claimSuccess ? 'success' : 'error'}
              txHash={claimTxHash ?? null}
              error={claimError}
            />
          </div>
        )}

        {/* Withdraw Transaction Status */}
        {withdrawStatus !== 'idle' && (
          <div className="mb-4">
            <TxStatus status={withdrawStatus} txHash={withdrawTxHash} error={withdrawError} />
            {withdrawStatus === 'success' && (
              <Button onClick={handleReset} variant="ghost" size="sm" className="mt-2 w-full">
                Done
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        {withdrawStatus === 'idle' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleWithdraw}
              disabled={withdrawableAmount === BigInt(0) || withdrawLoading || isWithdrawing}
            >
              {withdrawLoading ? 'Processing...' : 'Withdraw All'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              nativeButton={false}
              render={<Link href={`/mint?market=${market.address}`} />}
            >
              Deposit More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
