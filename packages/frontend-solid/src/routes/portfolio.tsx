import { A } from '@solidjs/router';
import { createMemo, For, type JSX, Show } from 'solid-js';

import { useUIMode } from '@/providers/UIModeProvider';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs';

/**
 * Portfolio page - User positions overview
 *
 * Features:
 * - Overview of all user positions (PT, YT, LP tokens)
 * - Claimable yield display
 * - Redeem/withdraw actions
 * - Mode-aware display (simple vs pro)
 */
export default function PortfolioPage(): JSX.Element {
  const { isSimple } = useUIMode();

  // Placeholder: would be replaced with actual wallet connection state
  const isConnected = createMemo(() => false);
  const isLoading = createMemo(() => false);

  return (
    <div class="mx-auto max-w-7xl px-4 py-8">
      {/* Page Header */}
      <div class="mb-8">
        <h1 class="text-foreground text-3xl font-semibold">
          {isSimple() ? 'My Earnings' : 'Portfolio'}
        </h1>
        <p class="text-muted-foreground mt-2">
          {isSimple()
            ? 'View your deposits and earnings across all markets.'
            : 'Manage your PT, YT, and LP positions. Claim yield and redeem tokens at expiry.'}
        </p>
      </div>

      {/* Loading State */}
      <Show when={isLoading()}>
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <Skeleton class="h-[400px] rounded-lg" />
          </div>
          <div>
            <Skeleton class="h-[200px] rounded-lg" />
          </div>
        </div>
      </Show>

      {/* Not Connected State */}
      <Show when={!isLoading() && !isConnected()}>
        <Card>
          <CardContent class="py-12 text-center">
            <div class="text-muted-foreground mx-auto mb-4 h-16 w-16">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 class="text-foreground text-xl font-semibold">Connect Your Wallet</h2>
            <p class="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
              {isSimple()
                ? 'Connect your wallet to view your deposits and earnings.'
                : 'Connect your wallet to view and manage your PT, YT, and LP positions across all markets.'}
            </p>
            <div class="mt-6 flex justify-center gap-4">
              <Button size="lg">Connect Wallet</Button>
              <Button as={A} href="/mint" variant="outline" size="lg">
                {isSimple() ? 'Start Earning' : 'Explore Markets'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Show>

      {/* Connected State with Positions */}
      <Show when={!isLoading() && isConnected()}>
        <div class="grid gap-6 lg:grid-cols-3">
          {/* Positions Column */}
          <div class="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{isSimple() ? 'Your Deposits' : 'Your Positions'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Show when={!isSimple()} fallback={<SimplePositionsList />}>
                  <PositionsTabs />
                </Show>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div class="space-y-6">
            <PortfolioSummaryCard isSimple={isSimple()} />
            <Show when={!isSimple()}>
              <ClaimableYieldCard />
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Positions Tabs (Pro Mode)
// ============================================================================

function PositionsTabs(): JSX.Element {
  return (
    <Tabs defaultValue="all">
      <TabsList class="grid w-full grid-cols-4">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="pt">PT</TabsTrigger>
        <TabsTrigger value="yt">YT</TabsTrigger>
        <TabsTrigger value="lp">LP</TabsTrigger>
      </TabsList>
      <TabsContent value="all" class="pt-4">
        <PositionsPlaceholder type="all" />
      </TabsContent>
      <TabsContent value="pt" class="pt-4">
        <PositionsPlaceholder type="pt" />
      </TabsContent>
      <TabsContent value="yt" class="pt-4">
        <PositionsPlaceholder type="yt" />
      </TabsContent>
      <TabsContent value="lp" class="pt-4">
        <PositionsPlaceholder type="lp" />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================================
// Simple Positions List (Simple Mode)
// ============================================================================

function SimplePositionsList(): JSX.Element {
  // Placeholder data
  const positions: unknown[] = [];

  return (
    <Show
      when={positions.length > 0}
      fallback={
        <EmptyPositions
          message="You don't have any deposits yet."
          actionLabel="Start Earning"
          actionHref="/mint"
        />
      }
    >
      <div class="space-y-4">
        <For each={positions}>
          {() => (
            <div class="bg-muted/30 rounded-lg border p-4">{/* Position card placeholder */}</div>
          )}
        </For>
      </div>
    </Show>
  );
}

// ============================================================================
// Positions Placeholder
// ============================================================================

interface PositionsPlaceholderProps {
  type: 'all' | 'pt' | 'yt' | 'lp';
}

function PositionsPlaceholder(props: PositionsPlaceholderProps): JSX.Element {
  const typeLabels = {
    all: 'positions',
    pt: 'Principal Token positions',
    yt: 'Yield Token positions',
    lp: 'LP positions',
  };

  const actionLabels = {
    all: 'Explore Markets',
    pt: 'Mint PT',
    yt: 'Mint YT',
    lp: 'Add Liquidity',
  };

  const actionHrefs = {
    all: '/mint',
    pt: '/mint',
    yt: '/mint',
    lp: '/pools',
  };

  return (
    <EmptyPositions
      message={`You don't have any ${typeLabels[props.type]} yet.`}
      actionLabel={actionLabels[props.type]}
      actionHref={actionHrefs[props.type]}
    />
  );
}

// ============================================================================
// Empty Positions
// ============================================================================

interface EmptyPositionsProps {
  message: string;
  actionLabel: string;
  actionHref: string;
}

function EmptyPositions(props: EmptyPositionsProps): JSX.Element {
  return (
    <div class="bg-muted/30 rounded-lg border border-dashed p-8 text-center">
      <div class="text-muted-foreground mx-auto mb-4 h-12 w-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      </div>
      <p class="text-muted-foreground text-sm">{props.message}</p>
      <Button as={A} href={props.actionHref} variant="outline" size="sm" class="mt-4">
        {props.actionLabel}
      </Button>
    </div>
  );
}

// ============================================================================
// Portfolio Summary Card
// ============================================================================

interface PortfolioSummaryCardProps {
  isSimple: boolean;
}

function PortfolioSummaryCard(props: PortfolioSummaryCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle class="text-lg">{props.isSimple ? 'Summary' : 'Portfolio Summary'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {/* Total Value */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">Total Value</span>
            <span class="font-mono font-semibold">$0.00</span>
          </div>

          {/* Total Deposited */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">
              {props.isSimple ? 'Total Deposited' : 'Total Invested'}
            </span>
            <span class="font-mono">$0.00</span>
          </div>

          {/* Total Earnings */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">
              {props.isSimple ? 'Earnings' : 'Unrealized P&L'}
            </span>
            <span class="text-success font-mono">+$0.00</span>
          </div>

          <Show when={!props.isSimple}>
            {/* Claimable Yield */}
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground text-sm">Claimable Yield</span>
              <span class="text-primary font-mono">$0.00</span>
            </div>
          </Show>

          {/* Active Positions Count */}
          <div class="border-border flex items-center justify-between border-t pt-4">
            <span class="text-muted-foreground text-sm">
              {props.isSimple ? 'Active Deposits' : 'Active Positions'}
            </span>
            <span class="font-mono">0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Claimable Yield Card (Pro Mode)
// ============================================================================

function ClaimableYieldCard(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle class="text-lg">Claimable Yield</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {/* Yield from YT */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">From YT Holdings</span>
            <span class="font-mono">$0.00</span>
          </div>

          {/* Yield from LP */}
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-sm">From LP Fees</span>
            <span class="font-mono">$0.00</span>
          </div>

          {/* Total Claimable */}
          <div class="border-border flex items-center justify-between border-t pt-4">
            <span class="text-foreground font-medium">Total Claimable</span>
            <span class="text-primary font-mono font-semibold">$0.00</span>
          </div>

          {/* Claim Button */}
          <Button class="w-full" disabled>
            Claim All Yield
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
