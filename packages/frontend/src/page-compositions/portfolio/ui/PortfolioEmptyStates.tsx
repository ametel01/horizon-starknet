'use client';

import { Button } from '@shared/ui/Button';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Empty state when wallet is not connected.
 */
export function ConnectWalletPrompt(): ReactNode {
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

/**
 * Loading state with skeleton cards.
 */
export function PortfolioLoadingState(): ReactNode {
  return (
    <div className="space-y-4">
      <SkeletonCard className="h-[200px]" />
      <SkeletonCard className="h-[200px]" />
    </div>
  );
}

/**
 * Empty state when user has no positions.
 */
export function NoPositionsPrompt(): ReactNode {
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
