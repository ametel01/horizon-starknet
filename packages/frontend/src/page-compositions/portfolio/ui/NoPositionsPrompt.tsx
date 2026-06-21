'use client';

import { Button } from '@shared/ui/Button';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Empty state when user has no positions.
 */
export function NoPositionsPrompt(): ReactNode {
  return (
    <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <Wallet className="text-muted-foreground size-8" />
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
