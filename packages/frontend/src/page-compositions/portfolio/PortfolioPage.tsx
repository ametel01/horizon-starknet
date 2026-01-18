'use client';

import {
  type EnhancedPosition,
  EnhancedPositionCard,
  SimplePortfolio,
  type YieldEarnedData,
} from '@entities/position';
import { useDashboardMarkets } from '@features/markets';
import {
  type MarketPosition,
  useEnhancedPositions,
  usePositions,
  useUserIndexedPositions,
} from '@features/portfolio';
import {
  calculateMinSyOut,
  useRedeemPtPostExpiry,
  useRedeemPy,
  useRedeemPyWithInterest,
  useUnwrapSy,
} from '@features/redeem';
import { useStarknet } from '@features/wallet';
import {
  InterestClaimPreview,
  useClaimAllYield,
  useClaimYield,
  useInterestFee,
  usePostExpiryStatus,
  useUserYield,
} from '@features/yield';
import { formatWad } from '@shared/math/wad';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  hasAnyBalance as checkHasAnyBalance,
  deriveTokenSymbols,
  deriveTxStatus,
} from './lib/positionCardLogic';
import { useAutoReset } from './lib/useAutoReset';
import {
  ConnectWalletPrompt,
  NoPositionsPrompt,
  PortfolioLoadingState,
} from './ui/PortfolioEmptyStates';
import {
  ClaimAllStatus,
  LpAnalyticsSection,
  PortfolioSummaryGrid,
  PortfolioValueSection,
  TransactionHistorySection,
  YieldAnalyticsSection,
} from './ui/PortfolioSections';
import {
  ClaimableYieldSection,
  LpPositionSection,
  QuickActionsSection,
  RedemptionSection,
  TokenBalancesSection,
  UnwrapSection,
} from './ui/PositionCardSections';

function PositionCard({ position }: { position: MarketPosition }): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  // Derive token symbols using extracted pure function
  const symbols = deriveTokenSymbols(position.market.metadata);

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

  // Derive transaction statuses using extracted pure function
  const claimTxStatus = deriveTxStatus(isClaimingYield, claimSuccess, claimError);
  const redeemPyTxStatus = deriveTxStatus(isRedeemingPy, redeemPySuccess, redeemPyError);
  const redeemPtTxStatus = deriveTxStatus(isRedeemingPt, redeemPtSuccess, redeemPtError);
  const unwrapTxStatus = deriveTxStatus(isUnwrapping, unwrapSuccess, unwrapError);

  // Auto-reset states after success using extracted hook
  useAutoReset(claimSuccess, resetClaim);
  useAutoReset(redeemPySuccess, resetRedeemPy);
  useAutoReset(redeemPtSuccess, resetRedeemPt);

  // Handlers
  const handleClaimYield = useCallback((): void => {
    claimYield({ ytAddress: position.market.ytAddress });
  }, [claimYield, position.market.ytAddress]);

  const handleRedeemPy = useCallback((): void => {
    const amount =
      position.ptBalance < position.ytBalance ? position.ptBalance : position.ytBalance;
    const minSyOut = calculateMinSyOut(amount, 50);

    redeemPy({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      syAddress: position.market.syAddress,
      amount,
      minSyOut,
    });
  }, [redeemPy, position]);

  const handleRedeemPtPostExpiry = useCallback((): void => {
    const minSyOut = calculateMinSyOut(position.ptBalance, 50);

    redeemPtPostExpiry({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      syAddress: position.market.syAddress,
      amount: position.ptBalance,
      minSyOut,
    });
  }, [redeemPtPostExpiry, position]);

  const handleUnwrapSy = useCallback((): void => {
    if (position.syBalance <= 0n) return;
    const amountStr = formatWad(position.syBalance, 18);
    void unwrap(amountStr);
  }, [unwrap, position.syBalance]);

  // Computed values
  const hasBalance = checkHasAnyBalance(position);
  const canUnwrapSy = position.syBalance > 0n && underlyingAddress !== '';

  if (!hasBalance && position.claimableYield === 0n) {
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
              <CardTitle className="text-base">{symbols.ptSymbol} Market</CardTitle>
              <p className="text-muted-foreground text-sm">{symbols.tokenName}</p>
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
        <LpPositionSection position={position} symbols={symbols} />
        <TokenBalancesSection position={position} symbols={symbols} />
        <ClaimableYieldSection
          position={position}
          symbols={symbols}
          onClaim={handleClaimYield}
          isClaiming={isClaimingYield}
          claimSuccess={claimSuccess}
          txStatus={claimTxStatus}
          txHash={claimTxHash ?? null}
          error={claimErrorMsg}
        />
        <RedemptionSection
          position={position}
          symbols={symbols}
          onRedeemPy={handleRedeemPy}
          isRedeemingPy={isRedeemingPy}
          redeemPySuccess={redeemPySuccess}
          redeemPyTxStatus={redeemPyTxStatus}
          redeemPyTxHash={redeemPyTxHash ?? null}
          redeemPyError={redeemPyErrorMsg}
          onRedeemPt={handleRedeemPtPostExpiry}
          isRedeemingPt={isRedeemingPt}
          redeemPtSuccess={redeemPtSuccess}
          redeemPtTxStatus={redeemPtTxStatus}
          redeemPtTxHash={redeemPtTxHash ?? null}
          redeemPtError={redeemPtErrorMsg}
        />
        <UnwrapSection
          position={position}
          symbols={symbols}
          canUnwrap={canUnwrapSy}
          onUnwrap={handleUnwrapSy}
          isUnwrapping={isUnwrapping}
          unwrapSuccess={unwrapSuccess}
          txStatus={unwrapTxStatus}
          txHash={unwrapTxHash ?? null}
          error={unwrapErrorMsg}
        />
        <QuickActionsSection marketAddress={position.market.address} />
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
    redeemPyWithInterest,
    isRedeeming: isRedeemingPyWithInterest,
    isSuccess: redeemPyWithInterestSuccess,
    reset: resetRedeemPyWithInterest,
  } = useRedeemPyWithInterest();

  const {
    redeemPtPostExpiry,
    isRedeeming: isRedeemingPt,
    isSuccess: redeemPtSuccess,
    reset: resetRedeemPt,
  } = useRedeemPtPostExpiry();

  const { data: feeInfo } = useInterestFee(position.market.ytAddress);
  const { data: postExpiryStatus } = usePostExpiryStatus(
    position.market.isExpired ? position.market.ytAddress : undefined
  );

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
    if (redeemPySuccess || redeemPyWithInterestSuccess) {
      const timer = setTimeout(() => {
        resetRedeemPy();
        resetRedeemPyWithInterest();
      }, 5000);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [redeemPySuccess, redeemPyWithInterestSuccess, resetRedeemPy, resetRedeemPyWithInterest]);

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
    const shouldRedeemWithInterest = position.yield.claimable > 0n;

    if (shouldRedeemWithInterest) {
      redeemPyWithInterest({
        ytAddress: position.market.ytAddress,
        ptAddress: position.market.ptAddress,
        syAddress: position.market.syAddress,
        amount,
        redeemInterest: true,
      });
      return;
    }

    const minSyOut = calculateMinSyOut(amount, 50);

    redeemPy({
      ytAddress: position.market.ytAddress,
      ptAddress: position.market.ptAddress,
      syAddress: position.market.syAddress,
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
      syAddress: position.market.syAddress,
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

  const tokenSymbol = position.market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const claimPreview =
    position.yield.claimable > 0n ? (
      <InterestClaimPreview
        ytAddress={position.market.ytAddress}
        sySymbol={sySymbol}
        compact
        className="mt-2"
      />
    ) : null;

  const yieldFeeInfo = feeInfo
    ? {
        feeRatePercent: feeInfo.feeRatePercent,
        hasFee: feeInfo.hasFee,
      }
    : undefined;

  const postExpiryInfo = postExpiryStatus
    ? {
        isInitialized: postExpiryStatus.isInitialized,
        totalTreasuryInterestFormatted: postExpiryStatus.totalTreasuryInterestFormatted,
      }
    : undefined;

  const isRedeemingActive =
    isRedeemingPy ||
    isRedeemingPyWithInterest ||
    isRedeemingPt ||
    redeemPySuccess ||
    redeemPyWithInterestSuccess ||
    redeemPtSuccess;

  // Only show unwrap option if we have underlying address configured
  const canUnwrapSy = position.sy.amount > 0n && underlyingAddress !== '';

  return (
    <EnhancedPositionCard
      position={position}
      yieldEarned={yieldEarned}
      yieldFeeInfo={yieldFeeInfo}
      postExpiryInfo={postExpiryInfo}
      claimPreview={claimPreview ?? undefined}
      onClaimYield={handleClaimYield}
      onRedeemPtYt={handleRedeemPtYt}
      onRedeemPt={handleRedeemPt}
      onUnwrapSy={canUnwrapSy ? handleUnwrapSy : undefined}
      isClaimingYield={isClaimingYield || claimSuccess}
      isRedeeming={isRedeemingActive}
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

  // Derive claim all status using extracted helper
  const claimAllTxStatus = deriveTxStatus(isClaimingAll, claimAllSuccess, claimAllError);

  // Auto-reset after success using extracted hook
  useAutoReset(claimAllSuccess, resetClaimAll);

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

  // Collect SY addresses from positions for external rewards lookup
  const syAddresses = useMemo(() => {
    return markets.map((m) => m.syAddress);
  }, [markets]);

  // Collect YT addresses from positions for YT rewards lookup
  const ytAddresses = useMemo(() => {
    return markets.map((m) => m.ytAddress);
  }, [markets]);

  // Simple mode renders SimplePortfolio
  if (isSimple) {
    return <SimplePortfolio markets={markets} />;
  }

  const handleClaimAll = (): void => {
    if (!portfolio) return;

    const claimableYtAddresses = portfolio.positions
      .filter((p) => p.claimableYield > BigInt(0))
      .map((p) => p.market.ytAddress);

    if (claimableYtAddresses.length > 0) {
      claimAllYield({ ytAddresses: claimableYtAddresses });
    }
  };

  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading) {
    return <PortfolioLoadingState />;
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

  // Show "no positions" message when there's no portfolio data or no active positions
  if (isError || activePositions.length === 0) {
    return <NoPositionsPrompt />;
  }

  // Get enhanced positions or fall back to empty array
  const enhancedPositions = enhancedPortfolio?.positions ?? [];

  const totalValue = enhancedPortfolio?.totalValueUsd ?? 0;
  const totalPnl = enhancedPortfolio?.totalPnlUsd ?? 0;
  const totalPnlPercent = enhancedPortfolio?.totalPnlPercent ?? 0;
  const totalClaimable = enhancedPortfolio?.totalClaimableUsd ?? 0;

  // Render position card for enhanced or legacy positions
  const renderPositionCards = (): ReactNode => {
    if (enhancedPositions.length > 0) {
      return enhancedPositions.map((position) => {
        const legacyPosition = activePositions.find(
          (p) => p.market.address === position.market.address
        );
        const positionYield = yieldByYtAddress.get(position.market.ytAddress.toLowerCase());
        return (
          <EnhancedPositionCardWrapper
            key={position.market.address}
            position={position}
            legacyPosition={legacyPosition}
            yieldEarned={positionYield}
          />
        );
      });
    }
    return activePositions.map((position) => (
      <PositionCard key={position.market.address} position={position} />
    ));
  };

  return (
    <div className="space-y-8">
      <PortfolioSummaryGrid
        totalValue={totalValue}
        totalPnl={totalPnl}
        totalPnlPercent={totalPnlPercent}
        totalClaimable={totalClaimable}
        totalClaimableYield={portfolio?.totalClaimableYield ?? 0n}
        activePositionsCount={activePositions.length}
        marketsCount={markets.length}
        hasClaimableYield={portfolio?.hasClaimableYield === true}
        onClaimAll={handleClaimAll}
        isClaimingAll={isClaimingAll}
        claimAllSuccess={claimAllSuccess}
      />

      <ClaimAllStatus
        txStatus={claimAllTxStatus}
        txHash={claimAllTxHash ?? null}
        error={claimAllErrorMsg}
      />

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Your Positions
        </h2>
        {renderPositionCards()}
      </section>

      <YieldAnalyticsSection syAddresses={syAddresses} ytAddresses={ytAddresses} />
      <LpAnalyticsSection
        activeLpPositions={activeLpPositions}
        poolReservesByMarket={poolReservesByMarket}
      />
      <PortfolioValueSection />
      <TransactionHistorySection />
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
