'use client';

import { useDashboardMarkets } from '@features/markets';
import { useStarknet } from '@features/wallet';
import { useIsAdmin, useTreasuryYield, type YTTreasurySummary } from '@features/yield';
import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math';
import { Alert, AlertDescription, AlertTitle, Card, CardContent, Skeleton } from '@shared/ui';
import { LockIcon, RefreshCwIcon, WalletIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Treasury Dashboard for protocol administrators.
 *
 * Shows:
 * - Total pending treasury interest across all YT contracts
 * - Per-YT breakdown with fee rates and claimable amounts
 * - Admin-only access (wallet must be owner of at least one YT)
 */
export function TreasuryDashboard(): ReactNode {
  const { isConnected, address } = useStarknet();
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();

  // Get all YT addresses from markets
  const ytAddresses: string[] = [];
  for (const market of markets) {
    const { ytAddress } = market;
    if (ytAddress !== '' && ytAddress !== '0x0') {
      ytAddresses.push(ytAddress);
    }
  }

  // Check admin status
  const { isAdmin, isLoading: adminLoading, treasury } = useIsAdmin(ytAddresses);

  // Fetch treasury yield data
  const treasuryData = useTreasuryYield(ytAddresses);

  // Loading state
  if (marketsLoading || adminLoading) {
    return <DashboardSkeleton />;
  }

  // Not connected
  if (!isConnected) {
    return (
      <DashboardLayout>
        <Alert variant="default" className="mx-auto max-w-lg">
          <WalletIcon className="size-4" />
          <AlertTitle>Wallet Required</AlertTitle>
          <AlertDescription>Connect your wallet to access the treasury dashboard.</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Alert variant="destructive" className="mx-auto max-w-lg">
          <LockIcon className="size-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            <p>Your wallet is not authorized to access the treasury dashboard.</p>
            <p className="mt-2 font-mono text-xs opacity-70">
              Connected: {address?.slice(0, 10)}...{address?.slice(-8)}
            </p>
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Pending Interest"
          value={treasuryData.totalPendingInterestFormatted}
          sublabel="SY tokens"
          highlight
        />
        <StatCard
          label="YTs with Claimable Yield"
          value={String(treasuryData.ytWithYieldCount)}
          sublabel={`of ${String(ytAddresses.length)} total`}
        />
        <StatCard
          label="Treasury Address"
          value={treasury ? `${treasury.slice(0, 10)}...${treasury.slice(-8)}` : 'N/A'}
          sublabel="Protocol owner"
        />
      </div>

      {/* Per-YT Breakdown */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">YT Breakdown</h2>
          {treasuryData.isLoading && (
            <RefreshCwIcon className="text-muted-foreground size-4 animate-spin" />
          )}
        </div>

        {treasuryData.ytSummaries.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No YT contracts found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {treasuryData.ytSummaries.map((summary) => (
              <YTSummaryCard key={summary.ytAddress} summary={summary} />
            ))}
          </div>
        )}
      </section>

      {/* Info Section */}
      <section className="border-border bg-card/50 mt-8 rounded-lg border p-6">
        <h3 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          About Treasury Yield
        </h3>
        <div className="text-muted-foreground space-y-2 text-sm">
          <p>
            <span className="text-foreground font-medium">Interest Fee:</span> A percentage of user
            yield claims is redirected to the treasury. The fee rate is configurable per YT.
          </p>
          <p>
            <span className="text-foreground font-medium">Post-Expiry Yield:</span> After a YT
            expires, any additional yield that accrues is captured for the treasury rather than
            distributing to YT holders.
          </p>
          <p>
            <span className="text-foreground font-medium">Claiming:</span> Treasury yield must be
            claimed by the protocol owner. Use{' '}
            <code className="bg-muted rounded px-1">redeem_post_expiry_interest_for_treasury</code>{' '}
            on the YT contract.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}

/**
 * Layout wrapper for the dashboard
 */
function DashboardLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <Link
          href="/analytics"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Analytics
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
            <LockIcon className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Treasury Dashboard</h1>
            <p className="text-muted-foreground text-sm">Protocol administrator view</p>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

/**
 * Stat card component
 */
interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}

function StatCard({ label, value, sublabel, highlight }: StatCardProps): ReactNode {
  return (
    <Card className={cn('transition-colors', highlight && 'border-primary/50')}>
      <CardContent className="p-4">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {label}
        </span>
        <p
          className={cn(
            'mt-1 font-mono text-xl font-semibold',
            highlight ? 'text-primary' : 'text-foreground'
          )}
        >
          {value}
        </p>
        {sublabel !== undefined && (
          <span className="text-muted-foreground text-xs">{sublabel}</span>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Per-YT summary card
 */
function YTSummaryCard({ summary }: { summary: YTTreasurySummary }): ReactNode {
  const shortAddress = `${summary.ytAddress.slice(0, 10)}...${summary.ytAddress.slice(-8)}`;

  return (
    <Card
      className={cn('transition-colors', summary.hasYieldToClaim && 'border-l-primary border-l-4')}
    >
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Address and status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-foreground font-mono text-sm font-medium">{shortAddress}</span>
              {summary.isLoading && (
                <RefreshCwIcon className="text-muted-foreground size-3 animate-spin" />
              )}
            </div>
            {summary.feeInfo !== null && (
              <div className="text-muted-foreground mt-1 text-xs">
                Fee rate: {summary.feeInfo.feeRatePercent}
                {summary.postExpiryInfo?.isInitialized === true && (
                  <span className="text-warning ml-2">Post-expiry</span>
                )}
              </div>
            )}
          </div>

          {/* Pending yield */}
          <div className="text-right">
            <span className="text-muted-foreground text-xs">Pending Treasury Yield</span>
            <p
              className={cn(
                'font-mono text-lg font-semibold',
                summary.hasYieldToClaim ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {summary.pendingTreasuryInterestFormatted} SY
            </p>
          </div>
        </div>

        {/* Post-expiry details if initialized */}
        {summary.postExpiryInfo?.isInitialized === true && (
          <div className="border-border mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
            <div>
              <span className="text-muted-foreground">First PY Index</span>
              <p className="text-foreground font-mono">
                {formatWad(summary.postExpiryInfo.firstPyIndex)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Treasury Collected</span>
              <p className="text-foreground font-mono">
                {summary.postExpiryInfo.totalTreasuryInterestFormatted}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton
 */
function DashboardSkeleton(): ReactNode {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="mb-8 h-20 w-full" />
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
