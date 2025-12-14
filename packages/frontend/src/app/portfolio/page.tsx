'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { TxStatus } from '@/components/display/TxStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { type MarketPosition, usePositions } from '@/hooks/usePositions';
import { calculateMinSyOut, useRedeemPtPostExpiry, useRedeemPy } from '@/hooks/useRedeem';
import { useStarknet } from '@/hooks/useStarknet';
import { useClaimAllYield, useClaimYield } from '@/hooks/useYield';
import { formatWad } from '@/lib/math/wad';

function PositionCard({ position }: { position: MarketPosition }): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get token symbols from metadata - hide SY, show underlying
  const tokenSymbol = position.market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = position.market.metadata?.yieldTokenName ?? 'Unknown Market';
  const depositedLabel = `Deposited ${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;
  const ytSymbol = `YT-${tokenSymbol}`;

  const {
    claimYield,
    isClaiming: isClaimingYield,
    isSuccess: claimSuccess,
    isError: claimError,
    error: claimErrorMsg,
    transactionHash: claimTxHash,
    reset: resetClaim,
  } = useClaimYield();

  const {
    redeemPy,
    isRedeeming: isRedeemingPy,
    isSuccess: redeemPySuccess,
    isError: redeemPyError,
    error: redeemPyErrorMsg,
    transactionHash: redeemPyTxHash,
    reset: resetRedeemPy,
  } = useRedeemPy();

  const {
    redeemPtPostExpiry,
    isRedeeming: isRedeemingPt,
    isSuccess: redeemPtSuccess,
    isError: redeemPtError,
    error: redeemPtErrorMsg,
    transactionHash: redeemPtTxHash,
    reset: resetRedeemPt,
  } = useRedeemPtPostExpiry();

  const hasAnyBalance =
    position.syBalance > BigInt(0) ||
    position.ptBalance > BigInt(0) ||
    position.ytBalance > BigInt(0) ||
    position.lpBalance > BigInt(0);

  // Claim yield status
  const claimTxStatus = useMemo(() => {
    if (isClaimingYield) return 'pending' as const;
    if (claimSuccess) return 'success' as const;
    if (claimError) return 'error' as const;
    return 'idle' as const;
  }, [isClaimingYield, claimSuccess, claimError]);

  // Redeem PY status
  const redeemPyTxStatus = useMemo(() => {
    if (isRedeemingPy) return 'pending' as const;
    if (redeemPySuccess) return 'success' as const;
    if (redeemPyError) return 'error' as const;
    return 'idle' as const;
  }, [isRedeemingPy, redeemPySuccess, redeemPyError]);

  // Redeem PT post expiry status
  const redeemPtTxStatus = useMemo(() => {
    if (isRedeemingPt) return 'pending' as const;
    if (redeemPtSuccess) return 'success' as const;
    if (redeemPtError) return 'error' as const;
    return 'idle' as const;
  }, [isRedeemingPt, redeemPtSuccess, redeemPtError]);

  // Reset states after success
  useEffect(() => {
    if (claimSuccess) {
      const timer = setTimeout(() => {
        resetClaim();
      }, 5000);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [claimSuccess, resetClaim]);

  useEffect(() => {
    if (redeemPySuccess) {
      const timer = setTimeout(() => {
        resetRedeemPy();
      }, 5000);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [redeemPySuccess, resetRedeemPy]);

  useEffect(() => {
    if (redeemPtSuccess) {
      const timer = setTimeout(() => {
        resetRedeemPt();
      }, 5000);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [redeemPtSuccess, resetRedeemPt]);

  const handleClaimYield = (): void => {
    claimYield({ ytAddress: position.market.ytAddress });
  };

  const handleRedeemPy = (): void => {
    // Redeem the minimum of PT and YT balances
    const amount =
      position.ptBalance < position.ytBalance ? position.ptBalance : position.ytBalance;
    const minSyOut = calculateMinSyOut(amount, 50); // 0.5% slippage

    redeemPy({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      amount,
      minSyOut,
    });
  };

  const handleRedeemPtPostExpiry = (): void => {
    const minSyOut = calculateMinSyOut(position.ptBalance, 50); // 0.5% slippage

    redeemPtPostExpiry({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      amount: position.ptBalance,
      minSyOut,
    });
  };

  if (!hasAnyBalance && position.claimableYield === BigInt(0)) {
    return null;
  }

  return (
    <Card>
      <button
        type="button"
        className="w-full cursor-pointer text-left"
        onClick={(): void => {
          setIsExpanded(!isExpanded);
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{ptSymbol} Market</CardTitle>
              <p className="text-sm text-neutral-400">{tokenName}</p>
            </div>
            <div className="flex items-center gap-2">
              {position.market.isExpired ? (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                  Expired
                </span>
              ) : (
                <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                  {position.market.daysToExpiry.toFixed(0)} days left
                </span>
              )}
              <svg
                className={`h-5 w-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
        </CardHeader>
      </button>

      <CardContent className={isExpanded ? '' : 'hidden'}>
        {/* Token Balances */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-300">Token Balances</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-neutral-800/50 p-3">
              <div className="text-neutral-500">{depositedLabel}</div>
              <div className="font-mono text-neutral-100">{formatWad(position.syBalance, 4)}</div>
            </div>
            <div className="rounded-lg bg-neutral-800/50 p-3">
              <div className="text-neutral-500">{ptSymbol}</div>
              <div className="font-mono text-neutral-100">{formatWad(position.ptBalance, 4)}</div>
            </div>
            <div className="rounded-lg bg-neutral-800/50 p-3">
              <div className="text-neutral-500">{ytSymbol}</div>
              <div className="font-mono text-neutral-100">{formatWad(position.ytBalance, 4)}</div>
            </div>
            <div className="rounded-lg bg-neutral-800/50 p-3">
              <div className="text-neutral-500">LP-{tokenSymbol}</div>
              <div className="font-mono text-neutral-100">{formatWad(position.lpBalance, 4)}</div>
            </div>
          </div>
        </div>

        {/* Claimable Yield */}
        {position.claimableYield > BigInt(0) && (
          <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-400">Claimable Yield</div>
                <div className="font-mono text-lg text-green-300">
                  {formatWad(position.claimableYield, 6)} {tokenSymbol}
                </div>
              </div>
              <Button
                onClick={handleClaimYield}
                disabled={isClaimingYield || claimSuccess}
                size="sm"
              >
                {isClaimingYield ? 'Claiming...' : claimSuccess ? 'Claimed!' : 'Claim'}
              </Button>
            </div>
            {claimTxStatus !== 'idle' && (
              <div className="mt-2">
                <TxStatus
                  status={claimTxStatus}
                  txHash={claimTxHash ?? null}
                  error={claimErrorMsg}
                />
              </div>
            )}
          </div>
        )}

        {/* Redemption Options */}
        {(position.canRedeemPtYt || position.canRedeemPtPostExpiry) && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-medium text-neutral-300">Redemption Options</h4>

            {/* Redeem PT + YT (before expiry) */}
            {position.canRedeemPtYt && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-400">
                      Redeem {ptSymbol} + {ytSymbol}
                    </div>
                    <div className="text-xs text-neutral-400">
                      Burn matching {ptSymbol} & {ytSymbol} to receive {tokenSymbol}
                    </div>
                    <div className="mt-1 font-mono text-sm text-blue-300">
                      Max:{' '}
                      {formatWad(
                        position.ptBalance < position.ytBalance
                          ? position.ptBalance
                          : position.ytBalance,
                        4
                      )}{' '}
                      {ptSymbol}+{ytSymbol}
                    </div>
                  </div>
                  <Button
                    onClick={handleRedeemPy}
                    disabled={isRedeemingPy || redeemPySuccess}
                    size="sm"
                    variant="secondary"
                  >
                    {isRedeemingPy ? 'Redeeming...' : redeemPySuccess ? 'Redeemed!' : 'Redeem'}
                  </Button>
                </div>
                {redeemPyTxStatus !== 'idle' && (
                  <div className="mt-2">
                    <TxStatus
                      status={redeemPyTxStatus}
                      txHash={redeemPyTxHash ?? null}
                      error={redeemPyErrorMsg}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Redeem PT post expiry */}
            {position.canRedeemPtPostExpiry && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-yellow-400">Redeem Expired {ptSymbol}</div>
                    <div className="text-xs text-neutral-400">
                      Redeem {ptSymbol} for underlying asset
                    </div>
                    <div className="mt-1 font-mono text-sm text-yellow-300">
                      {formatWad(position.ptBalance, 4)} {ptSymbol} → {tokenSymbol}
                    </div>
                  </div>
                  <Button
                    onClick={handleRedeemPtPostExpiry}
                    disabled={isRedeemingPt || redeemPtSuccess}
                    size="sm"
                    variant="secondary"
                  >
                    {isRedeemingPt ? 'Redeeming...' : redeemPtSuccess ? 'Redeemed!' : 'Redeem'}
                  </Button>
                </div>
                {redeemPtTxStatus !== 'idle' && (
                  <div className="mt-2">
                    <TxStatus
                      status={redeemPtTxStatus}
                      txHash={redeemPtTxHash ?? null}
                      error={redeemPtErrorMsg}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/trade?market=${position.market.address}`}
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-center text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            Trade
          </Link>
          <Link
            href={`/pools?market=${position.market.address}`}
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-center text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            Manage LP
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioContent(): ReactNode {
  const { isConnected } = useStarknet();
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { data: portfolio, isLoading: positionsLoading, isError } = usePositions(markets);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    claimAllYield,
    isClaiming: isClaimingAll,
    isSuccess: claimAllSuccess,
    isError: claimAllError,
    error: claimAllErrorMsg,
    transactionHash: claimAllTxHash,
    reset: resetClaimAll,
  } = useClaimAllYield();

  // Claim all status
  const claimAllTxStatus = useMemo(() => {
    if (isClaimingAll) return 'pending' as const;
    if (claimAllSuccess) return 'success' as const;
    if (claimAllError) return 'error' as const;
    return 'idle' as const;
  }, [isClaimingAll, claimAllSuccess, claimAllError]);

  // Reset after success
  useEffect(() => {
    if (claimAllSuccess) {
      const timer = setTimeout(() => {
        resetClaimAll();
      }, 5000);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [claimAllSuccess, resetClaimAll]);

  const handleClaimAll = (): void => {
    if (!portfolio) return;

    const ytAddresses = portfolio.positions
      .filter((p) => p.claimableYield > BigInt(0))
      .map((p) => p.market.ytAddress);

    if (ytAddresses.length > 0) {
      claimAllYield({ ytAddresses });
    }
  };

  const isLoading = !mounted || marketsLoading || positionsLoading;

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
        <p className="text-neutral-400">Connect your wallet to view your portfolio.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard className="h-[200px]" />
        <SkeletonCard className="h-[200px]" />
      </div>
    );
  }

  const activePositions =
    portfolio?.positions.filter(
      (p) =>
        p.syBalance > BigInt(0) ||
        p.ptBalance > BigInt(0) ||
        p.ytBalance > BigInt(0) ||
        p.lpBalance > BigInt(0) ||
        p.claimableYield > BigInt(0)
    ) ?? [];

  // Show "no positions" message when:
  // - There's no portfolio data (error or empty)
  // - Or there are no active positions
  if (isError || activePositions.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
        <p className="text-neutral-400">You have no positions yet.</p>
        <p className="mt-2 text-sm text-neutral-500">
          Start by minting PT+YT, trading, or providing liquidity.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/mint"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Mint PT + YT
          </Link>
          <Link
            href="/trade"
            className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-600"
          >
            Trade
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-neutral-800/50 p-4">
              <div className="text-sm text-neutral-400">Active Positions</div>
              <div className="mt-1 text-2xl font-semibold text-neutral-100">
                {activePositions.length}
              </div>
            </div>
            <div className="rounded-lg bg-neutral-800/50 p-4">
              <div className="text-sm text-neutral-400">Total Claimable Yield</div>
              <div className="mt-1 text-2xl font-semibold text-green-400">
                {formatWad(portfolio?.totalClaimableYield ?? BigInt(0), 4)} SY
              </div>
            </div>
            <div className="rounded-lg bg-neutral-800/50 p-4">
              <div className="text-sm text-neutral-400">Redeemable</div>
              <div className="mt-1 text-2xl font-semibold text-neutral-100">
                {portfolio?.hasRedeemablePositions ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {/* Claim All Button */}
          {portfolio?.hasClaimableYield && (
            <div className="mt-4">
              <Button
                onClick={handleClaimAll}
                disabled={isClaimingAll || claimAllSuccess}
                className="w-full"
              >
                {isClaimingAll
                  ? 'Claiming All...'
                  : claimAllSuccess
                    ? 'All Claimed!'
                    : `Claim All Yield (${formatWad(portfolio.totalClaimableYield, 4)} SY)`}
              </Button>
              {claimAllTxStatus !== 'idle' && (
                <div className="mt-2">
                  <TxStatus
                    status={claimAllTxStatus}
                    txHash={claimAllTxHash ?? null}
                    error={claimAllErrorMsg}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-100">Your Positions</h2>
        {activePositions.map((position) => (
          <PositionCard key={position.market.address} position={position} />
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage(): ReactNode {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-neutral-100">Portfolio</h1>
        <p className="mt-2 text-neutral-400">
          View your positions, claim accrued yield, and manage redemptions
        </p>
      </div>

      {/* Content */}
      <PortfolioContent />
    </div>
  );
}
