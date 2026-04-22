'use client';

import {
  formatPercent,
  formatUsd,
  ImpermanentLossCalc,
  LpEntryExitTable,
  LpPnlCard,
  PnlBreakdown,
  PortfolioValueChart,
  PositionValueHistory,
  YieldByPosition,
  YieldEarnedCard,
  YieldHistory,
} from '@entities/position';
import type { LpPosition } from '@shared/api/types';
import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math/wad';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import { BentoCard, BentoGrid } from '@shared/ui/BentoCard';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { TransactionHistory } from '@widgets/analytics/TransactionHistory';
import { TxStatus } from '@widgets/display/TxStatus';
import {
  BeatImpliedScore,
  LpApyBreakdown,
  PortfolioRewardsCard,
  PositionPnlTimeline,
  YtCashflowChart,
} from '@widgets/portfolio';
import { TrendingUp, Wallet, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TxStatusValue } from '../lib/positionCardLogic';

// ============================================================================
// Yield Analytics Section
// ============================================================================

interface YieldAnalyticsSectionProps {
  syAddresses: string[];
  ytAddresses: string[];
}

export function YieldAnalyticsSection({
  syAddresses,
  ytAddresses,
}: YieldAnalyticsSectionProps): ReactNode {
  return (
    <section className="space-y-4">
      <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
        Yield Analytics
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <YieldEarnedCard />
        <YieldByPosition />
      </div>
      <PortfolioRewardsCard syAddresses={syAddresses} ytAddresses={ytAddresses} />
      <YtCashflowChart />
      <YieldHistory limit={10} />
    </section>
  );
}

// ============================================================================
// LP Analytics Section
// ============================================================================

interface PoolReserves {
  syReserve: bigint;
  ptReserve: bigint;
  totalLpSupply: bigint;
}

interface LpAnalyticsSectionProps {
  activeLpPositions: LpPosition[];
  poolReservesByMarket: Map<string, PoolReserves>;
}

export function LpAnalyticsSection({
  activeLpPositions,
  poolReservesByMarket,
}: LpAnalyticsSectionProps): ReactNode {
  if (activeLpPositions.length === 0) return null;

  return (
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
  );
}

// ============================================================================
// Portfolio Value Section
// ============================================================================

export function PortfolioValueSection(): ReactNode {
  return (
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
  );
}

// ============================================================================
// Transaction History Section
// ============================================================================

export function TransactionHistorySection(): ReactNode {
  return (
    <section className="space-y-4">
      <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
        Transaction History
      </h2>
      <TransactionHistory />
    </section>
  );
}

// ============================================================================
// Portfolio Summary Grid
// ============================================================================

interface PortfolioSummaryGridProps {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  totalClaimable: number;
  totalClaimableYield: bigint;
  activePositionsCount: number;
  marketsCount: number;
  hasClaimableYield: boolean;
  onClaimAll: () => void;
  isClaimingAll: boolean;
  claimAllSuccess: boolean;
}

export function PortfolioSummaryGrid({
  totalValue,
  totalPnl,
  totalPnlPercent,
  totalClaimable,
  totalClaimableYield,
  activePositionsCount,
  marketsCount,
  hasClaimableYield,
  onClaimAll,
  isClaimingAll,
  claimAllSuccess,
}: PortfolioSummaryGridProps): ReactNode {
  return (
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
            {activePositionsCount}
          </span>
          <span className="text-muted-foreground mt-1 text-sm">across {marketsCount} markets</span>
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
                ({formatWad(totalClaimableYield, 4)} SY)
              </span>
            </div>
          </div>
          {hasClaimableYield && (
            <Button
              nativeButton
              onClick={onClaimAll}
              disabled={isClaimingAll || claimAllSuccess}
              size="sm"
            >
              {isClaimingAll ? 'Claiming...' : claimAllSuccess ? 'Claimed!' : 'Claim All Yield'}
            </Button>
          )}
        </div>
      </BentoCard>
    </BentoGrid>
  );
}

// ============================================================================
// Claim All Status
// ============================================================================

interface ClaimAllStatusProps {
  txStatus: TxStatusValue;
  txHash: string | null;
  error: Error | null;
}

export function ClaimAllStatus({ txStatus, txHash, error }: ClaimAllStatusProps): ReactNode {
  if (txStatus === 'idle') return null;

  return (
    <Card>
      <CardContent className="p-4">
        <TxStatus status={txStatus} txHash={txHash} error={error} />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Positions Section
// ============================================================================

interface PositionsSectionProps<TPosition, _TCardProps> {
  positions: TPosition[];
  renderCard: (position: TPosition) => ReactNode;
}

export function PositionsSection<TPosition>({
  positions,
  renderCard,
}: PositionsSectionProps<TPosition, unknown>): ReactNode {
  return (
    <section className="space-y-4">
      <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
        Your Positions
      </h2>
      {positions.map((position, _index) => renderCard(position))}
    </section>
  );
}
