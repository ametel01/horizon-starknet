'use client';

import { cn } from '@shared/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { PauseCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useIsSyPaused, useSyPauseState } from '../model/useSyPauseState';
import { useIsSyPausedIndexed, useSyPauseStateIndexed } from '../model/useSyPauseStateIndexed';

interface PausedWarningBannerProps {
  /** SY contract address to check pause state */
  syAddress: string | undefined;
  /**
   * Context for the warning message.
   * - 'deposit': Shown in wrap/deposit forms (deposits blocked)
   * - 'withdraw': Shown in unwrap/redeem forms (redemptions still allowed)
   */
  context: 'deposit' | 'withdraw';
  /**
   * Use indexed data from API instead of contract RPC call.
   * Faster but may have slight delay in reflecting state changes.
   * Default: false (use contract call for real-time accuracy)
   */
  useIndexed?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Warning banner shown when an SY contract is paused.
 *
 * When an SY contract is paused:
 * - Deposits (mints) are BLOCKED
 * - Transfers are BLOCKED
 * - Redemptions (burns) are ALLOWED (users can always exit)
 *
 * This component shows appropriate messaging based on context:
 * - In deposit forms: Warning that deposits are blocked
 * - In withdraw forms: Info that redemptions are still allowed
 *
 * @example
 * ```tsx
 * // In deposit/wrap form (real-time from contract)
 * <PausedWarningBanner syAddress={syAddress} context="deposit" />
 *
 * // Using indexed data (faster, for market lists)
 * <PausedWarningBanner syAddress={syAddress} context="deposit" useIndexed />
 *
 * // In redeem/unwrap form
 * <PausedWarningBanner syAddress={syAddress} context="withdraw" />
 * ```
 */
export function PausedWarningBanner({
  syAddress,
  context,
  useIndexed = false,
  className,
}: PausedWarningBannerProps): ReactNode {
  // Use either contract call or indexed API based on prop
  const contractQuery = useSyPauseState(useIndexed ? undefined : syAddress);
  const indexedQuery = useSyPauseStateIndexed(useIndexed ? syAddress : undefined);

  const isLoading = useIndexed ? indexedQuery.isLoading : contractQuery.isLoading;
  const isPausedContract = useIsSyPaused(useIndexed ? undefined : syAddress);
  const isPausedIndexed = useIsSyPausedIndexed(useIndexed ? syAddress : undefined);
  const isPaused = useIndexed ? isPausedIndexed : isPausedContract;

  // Don't render while loading or if not paused
  if (isLoading || !isPaused) {
    return null;
  }

  // Context-specific messaging
  if (context === 'deposit') {
    return (
      <Alert variant="warning" className={cn(className)}>
        <PauseCircleIcon className="size-4" />
        <AlertTitle>Deposits Paused</AlertTitle>
        <AlertDescription>
          This asset is temporarily paused. Deposits are not available at this time. Withdrawals
          remain available if you have existing deposits.
        </AlertDescription>
      </Alert>
    );
  }

  // Withdraw context - show info that redemptions are still allowed
  return (
    <Alert variant="info" className={cn(className)}>
      <PauseCircleIcon className="size-4" />
      <AlertTitle>Asset Paused</AlertTitle>
      <AlertDescription>
        This asset is currently paused, but withdrawals remain available. You can redeem your tokens
        at any time.
      </AlertDescription>
    </Alert>
  );
}

export type { PausedWarningBannerProps };
