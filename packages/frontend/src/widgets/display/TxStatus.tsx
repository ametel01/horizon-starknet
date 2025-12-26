'use client';

import { type ReactNode } from 'react';

import type { TxStatus as TxStatusType } from '@shared/hooks/useTransaction';
import { getModeAwareErrorMessage } from '@shared/lib/errors';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Card, CardContent } from '@shared/ui/Card';

interface TxStatusProps {
  status: TxStatusType;
  txHash: string | null;
  error: Error | null;
  className?: string;
}

export function TxStatus({ status, txHash, error, className }: TxStatusProps): ReactNode {
  const { isSimple } = useUIMode();

  if (status === 'idle') {
    return null;
  }

  // Get mode-aware status text
  const statusText = getStatusText(status, isSimple);

  // Get mode-aware error message
  const errorMessage = error ? getModeAwareErrorMessage(error, isSimple) : null;

  return (
    <Card
      size="sm"
      className={cn(
        status === 'signing' && 'border-chart-1/20 bg-chart-1/10',
        status === 'pending' && 'border-secondary/20 bg-secondary/10',
        status === 'success' && 'border-primary/20 bg-primary/10',
        status === 'error' && 'border-destructive/20 bg-destructive/10',
        className
      )}
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
                status === 'success' && 'text-primary',
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
            {errorMessage ? <p className="text-destructive mt-1 text-sm">{errorMessage}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: TxStatusType }): ReactNode {
  if (status === 'signing') {
    return <div className="bg-chart-1 h-5 w-5 animate-pulse rounded-full" />;
  }

  if (status === 'pending') {
    return (
      <div className="border-muted-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
    );
  }

  if (status === 'success') {
    return (
      <svg className="text-primary h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
