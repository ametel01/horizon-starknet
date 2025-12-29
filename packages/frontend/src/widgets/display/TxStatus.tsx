'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import type { TxStatus as TxStatusType } from '@shared/hooks/useTransaction';
import {
  getModeAwareErrorMessage,
  getErrorHelpText,
  isSlippageError,
  isDeadlineError,
} from '@shared/lib/errors';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { Progress, ProgressIndicator, ProgressTrack } from '@shared/ui/progress';

interface TxStatusProps {
  status: TxStatusType;
  txHash: string | null;
  error: Error | null;
  className?: string;
  /** Optional: Show "What's next?" guidance on success */
  showNextSteps?: boolean;
  /** Network for explorer links (defaults to mainnet) */
  network?: 'mainnet' | 'sepolia' | 'devnet';
  /** Optional: Gas estimate to display during signing state (Jakob's Law) */
  gasEstimate?: {
    formattedFee: string;
    isLoading?: boolean;
    error?: Error | null;
  };
  /** Optional: Callback when user wants to adjust slippage settings */
  onAdjustSlippage?: () => void;
}

export function TxStatus({
  status,
  txHash,
  error,
  className,
  showNextSteps = true,
  network = 'mainnet',
  gasEstimate,
  onAdjustSlippage,
}: TxStatusProps): ReactNode {
  const { isSimple } = useUIMode();

  if (status === 'idle') {
    return null;
  }

  // Get mode-aware status text
  const statusText = getStatusText(status, isSimple);

  // Get mode-aware error message
  const errorMessage = error ? getModeAwareErrorMessage(error, isSimple) : null;

  // Get actionable help text for errors (Gap 4: Enhanced Error UX)
  const helpText = error ? getErrorHelpText(error, isSimple) : null;
  const showSlippageAction =
    error !== null && isSlippageError(error) && onAdjustSlippage !== undefined;
  const showDeadlineHint = error !== null && isDeadlineError(error);

  // Get explorer URL for transaction
  const explorerUrl = txHash ? getExplorerUrl(network, txHash) : null;

  // Enhanced success state (Peak-End Rule)
  if (status === 'success') {
    return (
      <Card
        size="sm"
        className={cn('border-primary/20 bg-primary/10', className)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Success header with animated icon */}
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 flex h-10 w-10 items-center justify-center rounded-full">
                <svg
                  className="text-primary animate-bounce-in h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  role="img"
                  aria-label="Transaction successful"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-primary font-medium">{statusText}</p>
                {txHash && explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary/80 hover:text-primary mt-1 inline-flex items-center gap-1 font-mono text-sm transition-colors hover:underline"
                  >
                    View on Explorer
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                ) : null}
              </div>
            </div>

            {/* What's next section */}
            {showNextSteps && (
              <div className="border-primary/20 flex items-center justify-between gap-2 border-t pt-3">
                <span className="text-muted-foreground text-sm">What&apos;s next?</span>
                <Link
                  href="/portfolio"
                  className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                >
                  View Portfolio →
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Standard states (signing, pending, error)
  return (
    <Card
      size="sm"
      className={cn(
        status === 'signing' && 'border-chart-1/20 bg-chart-1/10',
        status === 'pending' && 'border-secondary/20 bg-secondary/10',
        status === 'error' && 'border-destructive/20 bg-destructive/10',
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div className="flex-1">
            <p
              className={cn(
                'font-medium',
                status === 'signing' && 'text-chart-1',
                status === 'pending' && 'text-muted-foreground',
                status === 'error' && 'text-destructive'
              )}
            >
              {statusText}
            </p>
            {txHash ? (
              <p className="text-muted-foreground mt-1 font-mono text-sm">
                Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            ) : null}
            {/* Enhanced error display with actionable suggestions (Gap 4: Enhanced Error UX) */}
            {errorMessage ? (
              <div className="mt-1 space-y-2">
                <p className="text-destructive text-sm">{errorMessage}</p>
                {helpText ? (
                  <p className="text-muted-foreground text-sm">
                    <span className="font-medium">Suggestion:</span> {helpText}
                  </p>
                ) : null}
                {showSlippageAction ? (
                  <Button size="sm" variant="outline" onClick={onAdjustSlippage} className="mt-1">
                    Adjust Slippage
                  </Button>
                ) : null}
                {showDeadlineHint && !helpText ? (
                  <p className="text-muted-foreground text-sm">
                    Try again with a longer deadline or during lower network congestion.
                  </p>
                ) : null}
              </div>
            ) : null}
            {/* Show gas estimate during signing state (Jakob's Law - users expect gas info) */}
            {status === 'signing' && gasEstimate && (
              <div className="mt-2">
                <GasEstimate
                  formattedFee={gasEstimate.formattedFee}
                  {...(gasEstimate.isLoading !== undefined && { isLoading: gasEstimate.isLoading })}
                  {...(gasEstimate.error !== undefined && { error: gasEstimate.error })}
                />
              </div>
            )}
          </div>
        </div>
        {/* Progress bar for pending state - indeterminate animation */}
        {status === 'pending' && (
          <div className="mt-3">
            <Progress value={null}>
              <ProgressTrack className="h-1.5">
                <ProgressIndicator className="bg-muted-foreground animate-progress-indeterminate" />
              </ProgressTrack>
            </Progress>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: TxStatusType }): ReactNode {
  if (status === 'signing') {
    return (
      <div
        className="bg-chart-1 h-5 w-5 animate-pulse rounded-full"
        role="img"
        aria-label="Waiting for signature"
      />
    );
  }

  if (status === 'pending') {
    return (
      <div
        className="border-muted-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
        role="img"
        aria-label="Transaction pending"
      />
    );
  }

  if (status === 'success') {
    return (
      <svg
        className="text-primary h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        role="img"
        aria-label="Transaction successful"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'error') {
    return (
      <svg
        className="text-destructive h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        role="img"
        aria-label="Transaction failed"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    );
  }

  return null;
}

function getStatusText(status: TxStatusType, isSimple: boolean): string {
  switch (status) {
    case 'signing':
      return isSimple ? 'Confirm in wallet...' : 'Waiting for signature...';
    case 'pending':
      return isSimple ? 'Processing...' : 'Transaction pending...';
    case 'success':
      return isSimple ? 'Success!' : 'Transaction successful!';
    case 'error':
      return isSimple ? 'Failed' : 'Transaction failed';
    default:
      return '';
  }
}

interface TxLinkProps {
  txHash: string;
  network?: 'mainnet' | 'sepolia' | 'devnet';
  className?: string;
}

export function TxLink({ txHash, network = 'sepolia', className }: TxLinkProps): ReactNode {
  const explorerUrl = getExplorerUrl(network, txHash);

  if (!explorerUrl) {
    return (
      <span className={cn('text-muted-foreground font-mono text-sm', className)}>
        {txHash.slice(0, 10)}...{txHash.slice(-8)}
      </span>
    );
  }

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-primary hover:text-primary font-mono text-sm hover:underline', className)}
    >
      {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
    </a>
  );
}

function getExplorerUrl(network: string, txHash: string): string | null {
  switch (network) {
    case 'mainnet':
      return `https://voyager.online/tx/${txHash}`;
    case 'sepolia':
      return `https://sepolia.voyager.online/tx/${txHash}`;
    case 'devnet':
      return null; // No explorer for local devnet
    default:
      return null;
  }
}
