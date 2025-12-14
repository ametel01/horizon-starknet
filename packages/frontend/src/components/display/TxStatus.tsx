'use client';

import { type ReactNode } from 'react';

import type { TxStatus as TxStatusType } from '@/hooks/useTransaction';
import { cn } from '@/lib/utils';

interface TxStatusProps {
  status: TxStatusType;
  txHash: string | null;
  error: Error | null;
  className?: string;
}

export function TxStatus({ status, txHash, error, className }: TxStatusProps): ReactNode {
  if (status === 'idle') {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        status === 'signing' && 'border-yellow-500/20 bg-yellow-500/10',
        status === 'pending' && 'border-blue-500/20 bg-blue-500/10',
        status === 'success' && 'border-green-500/20 bg-green-500/10',
        status === 'error' && 'border-red-500/20 bg-red-500/10',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div className="flex-1">
          <p
            className={cn(
              'font-medium',
              status === 'signing' && 'text-yellow-500',
              status === 'pending' && 'text-blue-500',
              status === 'success' && 'text-green-500',
              status === 'error' && 'text-red-500'
            )}
          >
            {getStatusText(status)}
          </p>
          {txHash ? (
            <p className="mt-1 font-mono text-sm text-neutral-400">
              Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
          ) : null}
          {error ? <p className="mt-1 text-sm text-red-400">{error.message}</p> : null}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TxStatusType }): ReactNode {
  if (status === 'signing') {
    return <div className="h-5 w-5 animate-pulse rounded-full bg-yellow-500" />;
  }

  if (status === 'pending') {
    return (
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    );
  }

  if (status === 'success') {
    return (
      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'error') {
    return (
      <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

function getStatusText(status: TxStatusType): string {
  switch (status) {
    case 'signing':
      return 'Waiting for signature...';
    case 'pending':
      return 'Transaction pending...';
    case 'success':
      return 'Transaction successful!';
    case 'error':
      return 'Transaction failed';
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
      <span className={cn('font-mono text-sm text-neutral-400', className)}>
        {txHash.slice(0, 10)}...{txHash.slice(-8)}
      </span>
    );
  }

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'font-mono text-sm text-blue-500 hover:text-blue-400 hover:underline',
        className
      )}
    >
      {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
    </a>
  );
}

function getExplorerUrl(network: string, txHash: string): string | null {
  switch (network) {
    case 'mainnet':
      return `https://starkscan.co/tx/${txHash}`;
    case 'sepolia':
      return `https://sepolia.starkscan.co/tx/${txHash}`;
    case 'devnet':
      return null; // No explorer for local devnet
    default:
      return null;
  }
}
