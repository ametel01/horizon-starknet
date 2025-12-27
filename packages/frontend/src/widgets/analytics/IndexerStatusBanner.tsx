'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useIndexerHealth } from '@features/analytics';
import { cn } from '@shared/lib/utils';
import { Badge } from '@shared/ui/badge';

interface IndexerStatusBannerProps {
  /** Only show when there are issues (default: true) */
  showOnlyIssues?: boolean;
  className?: string;
}

/**
 * Banner component that displays indexer health status.
 * Shows warnings when the indexer is degraded or unhealthy.
 */
export function IndexerStatusBanner({
  showOnlyIssues = true,
  className,
}: IndexerStatusBannerProps): ReactNode {
  const { data, isHealthy, isDegraded, lagBlocks, isLoading } = useIndexerHealth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render during SSR or initial load
  if (!mounted || isLoading) {
    return null;
  }

  // Don't show if healthy and showOnlyIssues is true
  if (showOnlyIssues && isHealthy) {
    return null;
  }

  const formatLag = (blocks: number | null): string => {
    if (blocks === null) return 'unknown';
    return `${String(blocks)} blocks`;
  };

  if (!data) {
    return (
      <div
        className={cn(
          'bg-destructive/10 text-destructive border-destructive/20 rounded-lg border px-4 py-2',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <AlertIcon />
          <span className="text-sm font-medium">Unable to connect to indexer</span>
        </div>
      </div>
    );
  }

  if (isDegraded) {
    return (
      <div
        className={cn(
          'border-warning/20 bg-warning/10 text-warning rounded-lg border px-4 py-2',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WarningIcon />
            <span className="text-sm font-medium">Data may be stale</span>
          </div>
          <Badge variant="outline" className="text-warning">
            {formatLag(lagBlocks)} behind
          </Badge>
        </div>
      </div>
    );
  }

  if (!isHealthy) {
    return (
      <div
        className={cn(
          'bg-destructive/10 text-destructive border-destructive/20 rounded-lg border px-4 py-2',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertIcon />
            <span className="text-sm font-medium">Indexer unavailable</span>
          </div>
          <Badge variant="destructive">Offline</Badge>
        </div>
      </div>
    );
  }

  // Show healthy status (when showOnlyIssues is false)
  return (
    <div
      className={cn(
        'bg-primary/10 text-primary border-primary/20 rounded-lg border px-4 py-2',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckIcon />
          <span className="text-sm font-medium">Indexer healthy</span>
        </div>
        <Badge variant="default">Live</Badge>
      </div>
    </div>
  );
}

function AlertIcon(): ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function WarningIcon(): ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
