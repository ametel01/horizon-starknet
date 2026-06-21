'use client';

import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

export { NoPositionsPrompt } from './NoPositionsPrompt';
export { PortfolioLoadingState } from './PortfolioLoadingState';

/**
 * Empty state when wallet is not connected.
 */
export function ConnectWalletPrompt(): ReactNode {
  return (
    <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <Wallet className="text-muted-foreground size-8" />
      </div>
      <h3 className="text-foreground text-lg font-semibold">Connect your wallet</h3>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        Connect your wallet to view your positions, claim yield, and manage your portfolio.
      </p>
    </div>
  );
}
