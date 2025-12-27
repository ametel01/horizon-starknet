'use client';

import { TrendingUp, Wallet, Zap } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { formatPercent, formatUsd } from '@entities/position';
import {
  EnhancedPositionCard,
  type EnhancedPosition,
  ImpermanentLossCalc,
  LpEntryExitTable,
  LpPnlCard,
  PnlBreakdown,
  PortfolioValueChart,
  PositionValueHistory,
  SimplePortfolio,
  type YieldEarnedData,
  YieldByPosition,
  YieldEarnedCard,
  YieldHistory,
} from '@entities/position';
import { useDashboardMarkets } from '@features/markets';
import { type MarketPosition, usePositions } from '@features/portfolio';
import { useEnhancedPositions, useUserIndexedPositions } from '@features/portfolio';
import {
  calculateMinSyOut,
  useRedeemPtPostExpiry,
  useRedeemPy,
  useUnwrapSy,
} from '@features/redeem';
import { useStarknet } from '@features/wallet';
import { useClaimAllYield, useClaimYield, useUserYield } from '@features/yield';
import { cn } from '@shared/lib/utils';
import { formatWad, formatWadCompact } from '@shared/math/wad';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import { BentoCard, BentoGrid } from '@shared/ui/BentoCard';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { TransactionHistory } from '@widgets/analytics/TransactionHistory';
import { TxStatus } from '@widgets/display/TxStatus';
import {
  BeatImpliedScore,
  LpApyBreakdown,
  PositionPnlTimeline,
  YtCashflowChart,
} from '@widgets/portfolio';

function PositionCard({ position }: { position: MarketPosition }): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get token symbols from metadata
  const tokenSymbol = position.market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = position.market.metadata?.yieldTokenName ?? 'Unknown Market';
  const sySymbol = `SY-${tokenSymbol}`;
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

  // Unwrap SY hook
  const underlyingAddress = position.market.metadata?.underlyingAddress ?? '';
  const {
    unwrap,
    isLoading: isUnwrapping,
    status: unwrapStatus,
    txHash: unwrapTxHash,
    error: unwrapErrorMsg,
  } = useUnwrapSy({
    underlyingAddress,
    syAddress: position.market.syAddress,
  });
  const unwrapSuccess = unwrapStatus === 'success';
  const unwrapError = unwrapStatus === 'error';

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

  // Unwrap SY status
  const unwrapTxStatus = useMemo(() => {
    if (isUnwrapping) return 'pending' as const;
    if (unwrapSuccess) return 'success' as const;
    if (unwrapError) return 'error' as const;
    return 'idle' as const;
  }, [isUnwrapping, unwrapSuccess, unwrapError]);

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

  // Note: We intentionally don't auto-reset unwrap status like deposit form
  // The success message stays visible until user takes another action

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

  const handleUnwrapSy = (): void => {
    if (position.syBalance <= BigInt(0)) return;
    // Convert bigint to string for the unwrap function (WAD format)
    const amountStr = formatWad(position.syBalance, 18);
    void unwrap(amountStr);
  };

  // Can only unwrap if we have underlying address configured
  const canUnwrapSy = position.syBalance > BigInt(0) && underlyingAddress !== '';

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
              <p className="text-muted-foreground text-sm">{tokenName}</p>
            </div>
            <div className="flex items-center gap-2">
              {position.market.isExpired ? (
                <span className="bg-destructive/20 text-destructive rounded px-2 py-0.5 text-xs">
                  Expired
                </span>
              ) : (
                <span className="bg-primary/20 text-primary rounded px-2 py-0.5 text-xs">
                  {position.market.daysToExpiry.toFixed(0)} days left
                </span>
              )}
              <svg
                className={`text-muted-foreground h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
        {/* LP Position (shown prominently if user has LP) */}
        {position.lpBalance > BigInt(0) && (
          <div className="border-chart-2/30 bg-chart-2/10 mb-4 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-chart-2 font-medium">LP Position</h4>
              <span className="text-muted-foreground text-sm">
                {position.lpSharePercent < 0.01 ? '< 0.01' : position.lpSharePercent.toFixed(2)}% of
                pool
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
                <div className="text-muted-foreground text-xs">Value in {sySymbol}</div>
                <div className="text-foreground font-mono text-lg">
                  {formatWadCompact(position.lpValueSy)}
                </div>
              </div>
              <div className="bg-background/50 rounded-lg p-3">
                <div className="text-muted-foreground text-xs">Value in {ptSymbol}</div>
                <div className="text-foreground font-mono text-lg">
                  {formatWadCompact(position.lpValuePt)}
                </div>
              </div>
            </div>
            <div className="bg-background/50 mt-3 rounded-lg p-3">
              <div className="text-chart-2 flex items-center gap-1.5 text-xs font-medium">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                Swap fees are automatically compounded into your LP position, increasing your share
                of pool reserves over time.
              </p>
            </div>
          </div>
        )}

        {/* Token Balances */}
        <div className="space-y-2">
          <h4 className="text-foreground text-sm font-medium">Token Balances</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted rounded-lg p-3">
              <div className="text-muted-foreground">{sySymbol}</div>
              <div className="text-foreground font-mono">
                {formatWadCompact(position.syBalance)}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-muted-foreground">{ptSymbol}</div>
              <div className="text-foreground font-mono">
                {formatWadCompact(position.ptBalance)}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-muted-foreground">{ytSymbol}</div>
              <div className="text-foreground font-mono">
                {formatWadCompact(position.ytBalance)}
              </div>
            </div>
            {position.lpBalance === BigInt(0) && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-muted-foreground">LP-{tokenSymbol}</div>
                <div className="text-muted-foreground font-mono">0</div>
              </div>
            )}
          </div>
        </div>

        {/* Claimable Yield from YT */}
        {position.claimableYield > BigInt(0) && (
          <div className="border-primary/30 bg-primary/10 mt-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-primary flex items-center gap-1.5 text-sm">
                  <span className="bg-primary/30 rounded px-1.5 py-0.5 text-xs font-medium">
                    YT
                  </span>
                  Accrued Yield
                </div>
                <div className="text-primary font-mono text-lg">
                  {formatWad(position.claimableYield, 6)} {sySymbol}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Interest earned from holding {ytSymbol}
                </p>
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
            <h4 className="text-foreground text-sm font-medium">Redemption Options</h4>

            {/* Redeem PT + YT (before expiry) */}
            {position.canRedeemPtYt && (
              <div className="border-secondary/30 bg-secondary/10 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Redeem {ptSymbol} + {ytSymbol}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Burn matching {ptSymbol} & {ytSymbol} to receive {sySymbol}
                    </div>
                    <div className="text-foreground mt-1 font-mono text-sm">
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
              <div className="border-chart-1/30 bg-chart-1/10 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-chart-1 text-sm">Redeem Expired {ptSymbol}</div>
                    <div className="text-muted-foreground text-xs">
                      Redeem {ptSymbol} for {sySymbol}
                    </div>
                    <div className="text-chart-1 mt-1 font-mono text-sm">
                      {formatWad(position.ptBalance, 4)} {ptSymbol} → {sySymbol}
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

        {/* Unwrap SY to Underlying */}
        {canUnwrapSy && (
          <div className="mt-4">
            <h4 className="text-foreground mb-3 text-sm font-medium">Withdraw</h4>
            <div className="border-chart-3/30 bg-chart-3/10 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-chart-3 text-sm">Withdraw {sySymbol}</div>
                  <div className="text-muted-foreground text-xs">
                    Convert {sySymbol} to {tokenSymbol}
                  </div>
                  <div className="text-foreground mt-1 font-mono text-sm">
                    {formatWad(position.syBalance, 4)} {sySymbol} → {tokenSymbol}
                  </div>
                </div>
                <Button
                  onClick={handleUnwrapSy}
                  disabled={isUnwrapping || unwrapSuccess}
                  size="sm"
                  variant="secondary"
                >
                  {isUnwrapping ? 'Withdrawing...' : unwrapSuccess ? 'Withdrawn!' : 'Withdraw'}
                </Button>
              </div>
              {unwrapTxStatus !== 'idle' && (
                <div className="mt-2">
                  <TxStatus
                    status={unwrapTxStatus}
                    txHash={unwrapTxHash ?? null}
                    error={unwrapErrorMsg}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            nativeButton={false}
            render={<Link href={`/trade?market=${position.market.address}`} />}
          >
            Trade
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            nativeButton={false}
            render={<Link href={`/pools?market=${position.market.address}`} />}
          >
            Manage LP
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Wrapper component that provides transaction handlers to EnhancedPositionCard
 */
function EnhancedPositionCardWrapper({
  position,
  legacyPosition,
  yieldEarned,
}: {
  position: EnhancedPosition;
  legacyPosition: MarketPosition | undefined;
  yieldEarned?: YieldEarnedData | undefined;
}): ReactNode {
  const {
    claimYield,
    isClaiming: isClaimingYield,
    isSuccess: claimSuccess,
    reset: resetClaim,
  } = useClaimYield();

  const {
    redeemPy,
    isRedeeming: isRedeemingPy,
    isSuccess: redeemPySuccess,
    reset: resetRedeemPy,
  } = useRedeemPy();

  const {
    redeemPtPostExpiry,
    isRedeeming: isRedeemingPt,
    isSuccess: redeemPtSuccess,
    reset: resetRedeemPt,
  } = useRedeemPtPostExpiry();

  // Unwrap SY hook - only enabled if we have underlying address
  const underlyingAddress = position.market.metadata?.underlyingAddress ?? '';
  const {
    unwrap,
    isLoading: isUnwrapping,
    status: unwrapStatus,
    txHash: unwrapTxHash,
    error: unwrapError,
  } = useUnwrapSy({
    underlyingAddress,
    syAddress: position.market.syAddress,
  });
  const unwrapSuccess = unwrapStatus === 'success';

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

  // Note: We intentionally don't auto-reset unwrap status like deposit form
  // The success message stays visible until user takes another action

  const handleClaimYield = (): void => {
    claimYield({ ytAddress: position.market.ytAddress });
  };

  const handleRedeemPtYt = (): void => {
    if (!legacyPosition) return;
    const amount =
      legacyPosition.ptBalance < legacyPosition.ytBalance
        ? legacyPosition.ptBalance
        : legacyPosition.ytBalance;
    const minSyOut = calculateMinSyOut(amount, 50);

    redeemPy({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      amount,
      minSyOut,
    });
  };

  const handleRedeemPt = (): void => {
    if (!legacyPosition) return;
    const minSyOut = calculateMinSyOut(legacyPosition.ptBalance, 50);

    redeemPtPostExpiry({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      amount: legacyPosition.ptBalance,
      minSyOut,
    });
  };

  const handleUnwrapSy = (): void => {
    if (position.sy.amount <= 0n) return;
    // Convert bigint to string for the unwrap function (WAD format)
    const amountStr = formatWad(position.sy.amount, 18);
    void unwrap(amountStr);
  };

  const isRedeeming = isRedeemingPy || isRedeemingPt || redeemPySuccess || redeemPtSuccess;

  // Only show unwrap option if we have underlying address configured
  const canUnwrapSy = position.sy.amount > 0n && underlyingAddress !== '';

  return (
    <EnhancedPositionCard
      position={position}
      yieldEarned={yieldEarned}
      onClaimYield={handleClaimYield}
      onRedeemPtYt={handleRedeemPtYt}
      onRedeemPt={handleRedeemPt}
      onUnwrapSy={canUnwrapSy ? handleUnwrapSy : undefined}
      isClaimingYield={isClaimingYield || claimSuccess}
      isRedeeming={isRedeeming}
      isUnwrapping={isUnwrapping || unwrapSuccess}
      unwrapTxStatus={unwrapStatus}
      unwrapTxHash={unwrapTxHash}
      unwrapError={unwrapError}
    />
  );
}

function PortfolioContent(): ReactNode {
  const { isConnected } = useStarknet();
  const { isSimple } = useUIMode();
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { data: portfolio, isLoading: positionsLoading, isError } = usePositions(markets);
  const { data: enhancedPortfolio, isLoading: enhancedLoading } = useEnhancedPositions(markets);
  const { data: yieldData } = useUserYield();
  const { lpPositions, isLoading: lpPositionsLoading } = useUserIndexedPositions();
  const [mounted, setMounted] = useState(false);

  // Build a map of YT address to yield data for position cards
  const yieldByYtAddress = useMemo(() => {
    const map = new Map<string, YieldEarnedData>();
    if (!yieldData) return map;

    for (const summary of yieldData.summaryByPosition) {
      map.set(summary.yt.toLowerCase(), {
        totalClaimed: summary.totalClaimed,
        totalClaimedUsd: 0, // Will be calculated in the component with prices
        claimCount: summary.claimCount,
      });
    }
    return map;
  }, [yieldData]);

  const {
    claimAllYield,
    isClaiming: isClaimingAll,
    isSuccess: claimAllSuccess,
    isError: claimAllError,
    error: claimAllErrorMsg,
    transactionHash: claimAllTxHash,
    reset: resetClaimAll,
  } = useClaimAllYield();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const isLoading =
    !mounted || marketsLoading || positionsLoading || enhancedLoading || lpPositionsLoading;

  // Build pool reserves map for IL calculations
  const poolReservesByMarket = useMemo(() => {
    const map = new Map<string, { syReserve: bigint; ptReserve: bigint; totalLpSupply: bigint }>();
    for (const market of markets) {
      map.set(market.address.toLowerCase(), {
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        totalLpSupply: market.state.totalLpSupply,
      });
    }
    return map;
  }, [markets]);

  // Filter LP positions with non-zero balance
  const activeLpPositions = useMemo(() => {
    return lpPositions.filter((p) => {
      try {
        return BigInt(p.netLpBalance) > 0n;
      } catch {
        return false;
      }
    });
  }, [lpPositions]);

  // Simple mode renders SimplePortfolio
  if (isSimple) {
    return <SimplePortfolio markets={markets} />;
  }

  const handleClaimAll = (): void => {
    if (!portfolio) return;

    const ytAddresses = portfolio.positions
      .filter((p) => p.claimableYield > BigInt(0))
      .map((p) => p.market.ytAddress);

    if (ytAddresses.length > 0) {
      claimAllYield({ ytAddresses });
    }
  };

  if (!isConnected) {
    return (
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Wallet className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">Connect your wallet</h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          Connect your wallet to view your positions, claim yield, and manage your portfolio.
        </p>
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
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Wallet className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">No positions yet</h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          Start earning yield by minting PT+YT tokens, trading, or providing liquidity.
        </p>
        <div className="mt-6 flex gap-3">
          <Button nativeButton={false} render={<Link href="/mint" />}>
            Mint PT + YT
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/trade" />}>
            Trade
          </Button>
        </div>
      </div>
    );
  }

  // Get enhanced positions or fall back to empty array
  const enhancedPositions = enhancedPortfolio?.positions ?? [];

  const totalValue = enhancedPortfolio?.totalValueUsd ?? 0;
  const totalPnl = enhancedPortfolio?.totalPnlUsd ?? 0;
  const totalPnlPercent = enhancedPortfolio?.totalPnlPercent ?? 0;
  const totalClaimable = enhancedPortfolio?.totalClaimableUsd ?? 0;

  return (
    <div className="space-y-8">
      {/* Summary Bento Grid */}
      <BentoGrid>
        {/* Total Value - Hero card */}
        <BentoCard colSpan={{ default: 12, md: 6, lg: 4 }} rowSpan={1} featured animationDelay={0}>
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

        {/* Unrealized P&L */}
        <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} animationDelay={50}>
          <div className="flex h-full flex-col justify-center p-4">
            <div className="flex items-center gap-2">
              <TrendingUp
                className={cn('h-4 w-4', totalPnl >= 0 ? 'text-green-500' : 'text-red-500')}
              />
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Unrealized P&L
              </span>
            </div>
            <span
              className={cn(
                'mt-2 font-mono text-2xl font-semibold',
                totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              <AnimatedNumber
                value={totalPnl}
                formatter={(v) => `${v >= 0 ? '+' : ''}${formatUsd(v)}`}
                duration={600}
              />
            </span>
            <span
              className={cn(
                'mt-1 text-sm',
                totalPnlPercent >= 0 ? 'text-green-500/70' : 'text-red-500/70'
              )}
            >
              {formatPercent(totalPnlPercent)}
            </span>
          </div>
        </BentoCard>

        {/* Active Positions */}
        <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} animationDelay={100}>
          <div className="flex h-full flex-col justify-center p-4">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Active Positions
            </span>
            <span className="text-foreground mt-2 font-mono text-3xl font-semibold">
              {activePositions.length}
            </span>
            <span className="text-muted-foreground mt-1 text-sm">
              across {markets.length} markets
            </span>
          </div>
        </BentoCard>

        {/* Claimable Yield - Full width with action */}
        <BentoCard colSpan={{ default: 12 }} rowSpan={1} animationDelay={150}>
          <div className="flex h-full items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="text-primary h-4 w-4" />
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Claimable Yield
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-primary font-mono text-2xl font-semibold">
                  <AnimatedNumber value={totalClaimable} formatter={formatUsd} duration={600} />
                </span>
                <span className="text-muted-foreground text-sm">
                  ({formatWad(portfolio?.totalClaimableYield ?? BigInt(0), 4)} SY)
                </span>
              </div>
            </div>
            {portfolio?.hasClaimableYield === true && (
              <Button
                nativeButton
                onClick={handleClaimAll}
                disabled={isClaimingAll || claimAllSuccess}
                size="sm"
              >
                {isClaimingAll ? 'Claiming...' : claimAllSuccess ? 'Claimed!' : 'Claim All Yield'}
              </Button>
            )}
          </div>
        </BentoCard>
      </BentoGrid>

      {/* Claim All Transaction Status */}
      {claimAllTxStatus !== 'idle' && (
        <Card>
          <CardContent className="p-4">
            <TxStatus
              status={claimAllTxStatus}
              txHash={claimAllTxHash ?? null}
              error={claimAllErrorMsg}
            />
          </CardContent>
        </Card>
      )}

      {/* Position Cards - Use enhanced positions with USD values */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Your Positions
        </h2>
        {enhancedPositions.length > 0
          ? enhancedPositions.map((position) => {
              // Find the matching legacy position for transaction handlers
              const legacyPosition = activePositions.find(
                (p) => p.market.address === position.market.address
              );
              // Get yield data for this position's YT address
              const positionYield = yieldByYtAddress.get(position.market.ytAddress.toLowerCase());
              return (
                <EnhancedPositionCardWrapper
                  key={position.market.address}
                  position={position}
                  legacyPosition={legacyPosition}
                  yieldEarned={positionYield}
                />
              );
            })
          : // Fall back to legacy position cards if enhanced data not available
            activePositions.map((position) => (
              <PositionCard key={position.market.address} position={position} />
            ))}
      </section>

      {/* Yield Analytics Section */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Yield Analytics
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <YieldEarnedCard />
          <YieldByPosition />
        </div>
        <YtCashflowChart />
        <YieldHistory limit={10} />
      </section>

      {/* LP Analytics Section */}
      {activeLpPositions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
            LP Analytics
          </h2>
          <LpApyBreakdown />
          <div className="grid gap-4 lg:grid-cols-2">
            {activeLpPositions.map((lpPosition) => {
              const poolReserves = poolReservesByMarket.get(lpPosition.market.toLowerCase());
              return (
                <div key={lpPosition.market} className="space-y-4">
                  <LpPnlCard position={lpPosition} poolReserves={poolReserves} />
                  {poolReserves && (
                    <ImpermanentLossCalc position={lpPosition} poolReserves={poolReserves} />
                  )}
                </div>
              );
            })}
          </div>
          <LpEntryExitTable limit={10} />
        </section>
      )}

      {/* Portfolio Value Over Time Section */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Portfolio Value
        </h2>
        <PortfolioValueChart />
        <div className="grid gap-4 lg:grid-cols-2">
          <PositionPnlTimeline />
          <BeatImpliedScore />
        </div>
        <PnlBreakdown />
        <PositionValueHistory limit={10} />
      </section>

      {/* Transaction History */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Transaction History
        </h2>
        <TransactionHistory />
      </section>
    </div>
  );
}

export function PortfolioPage(): ReactNode {
  const { isSimple } = useUIMode();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </Link>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Portfolio</h1>
        <p className="text-muted-foreground mt-1">
          {isSimple ? 'Your yield positions' : 'Positions, yield, and redemptions'}
        </p>
      </header>

      {/* Content */}
      <PortfolioContent />
    </div>
  );
}
