'use client';

import { ExternalLinkIcon, GiftIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTokenInfo } from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

import { type RewardClaimEvent, useRewardHistory } from '../model';

interface RewardClaimHistoryProps {
  /** User address to show claim history for */
  userAddress: string | undefined;
  /** Maximum number of claims to show (default: 10) */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate a transaction hash for display.
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Get block explorer URL for a transaction.
 */
function getExplorerUrl(txHash: string): string {
  // Default to Voyager - could be configured based on network
  return `https://voyager.online/tx/${txHash}`;
}

/**
 * Single claim event row component.
 */
function ClaimRow({ claim }: { claim: RewardClaimEvent }): ReactNode {
  const { data: tokenInfo, isLoading: tokenLoading } = useTokenInfo(claim.rewardToken);

  const symbol = tokenInfo?.symbol ?? 'TOKEN';
  const formattedAmount = formatWadCompact(claim.amount);

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {tokenLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <span className="font-mono text-sm font-medium">
              {formattedAmount} <span className="text-muted-foreground">{symbol}</span>
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          {formatTimestamp(claim.blockTimestamp)}
        </span>
      </div>
      <a
        href={getExplorerUrl(claim.transactionHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
        title="View on explorer"
      >
        {truncateHash(claim.transactionHash)}
        <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}

/**
 * Component showing a user's reward claim history from indexed data.
 *
 * Displays a chronological list of past reward claims with amounts,
 * timestamps, and links to the block explorer for each transaction.
 *
 * Uses the indexed API for fast loading without RPC calls.
 *
 * @example
 * ```tsx
 * <RewardClaimHistory userAddress={address} limit={5} />
 * ```
 */
export function RewardClaimHistory({
  userAddress,
  limit = 10,
  className,
}: RewardClaimHistoryProps): ReactNode {
  const { data, isLoading, error } = useRewardHistory(userAddress, { limit });

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="text-lg">Claim History</CardTitle>
          <CardDescription>Loading your reward claims...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="text-lg">Claim History</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load claim history
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Empty state
  if (!data?.claims || data.claims.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="text-lg">Claim History</CardTitle>
          <CardDescription>Your past reward claims will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="bg-muted-foreground/20 flex h-12 w-12 items-center justify-center rounded-full">
              <GiftIcon className="text-muted-foreground h-6 w-6" />
            </div>
            <p className="text-muted-foreground text-center text-sm">No claims yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-lg">Claim History</CardTitle>
        <CardDescription>
          {data.totalClaims === 1 ? '1 claim' : `${String(data.totalClaims)} claims`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-border divide-y">
          {data.claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type { RewardClaimHistoryProps };
