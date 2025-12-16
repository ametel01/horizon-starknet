'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAccount } from '@/hooks/useAccount';
import { useEnhancedPositions } from '@/hooks/useEnhancedPositions';
import { useSimpleWithdraw } from '@/hooks/useSimpleWithdraw';
import { useClaimYield } from '@/hooks/useYield';
import { formatWadCompact } from '@/lib/math/wad';
import { formatExpiry } from '@/lib/math/yield';
import { formatUsd } from '@/lib/position/value';
import { cn } from '@/lib/utils';
import type { MarketData } from '@/types/market';
import type { EnhancedPosition } from '@/types/position';

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
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4 text-center">
            Connect your wallet to view your positions
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  // Filter positions to only show those with PT or YT (ignore LP-only)
  const activePositions =
    portfolio?.positions.filter((p) => p.pt.amount > 0n || p.yt.amount > 0n) ?? [];

  const hasPositions = activePositions.length > 0;

  // Calculate simple totals (exclude LP)
  const totalValue = activePositions.reduce((sum, p) => sum + p.pt.valueUsd + p.yt.valueUsd, 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-muted rounded-lg p-4">
              <div className="text-muted-foreground text-sm">Total Value</div>
              <div className="text-foreground text-2xl font-bold">{formatUsd(totalValue)}</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-muted-foreground text-sm">Active Positions</div>
              <div className="text-foreground text-2xl font-bold">{activePositions.length}</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-muted-foreground text-sm">Claimable Yield</div>
              <div className="text-primary text-2xl font-bold">
                {formatUsd(portfolio?.totalClaimableUsd ?? 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positions List */}
      {hasPositions ? (
        <div className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">Your Positions</h2>
          {activePositions.map((position) => (
            <SimplePositionCard key={position.market.address} position={position} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4 text-center">
              You don&apos;t have any positions yet.
            </p>
            <Button nativeButton={false} render={<Link href="/mint" />}>
              Start Earning
            </Button>
          </CardContent>
        </Card>
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

        {/* Claimable Yield */}
        {hasClaimableYield && (
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
