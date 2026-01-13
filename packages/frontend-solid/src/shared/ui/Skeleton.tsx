import { cn } from '@shared/lib/utils';
import {
  type Component,
  type ComponentProps,
  createUniqueId,
  For,
  type JSX,
  splitProps,
} from 'solid-js';

// ============================================
// Base Skeleton
// ============================================

interface SkeletonProps extends ComponentProps<'div'> {
  /** Shimmer variant: default pulse or warm gradient shimmer */
  variant?: 'pulse' | 'shimmer';
}

/**
 * Base skeleton loading placeholder with optional warm shimmer effect.
 * Uses the Horizon amber theme for a distinctive loading experience.
 */
function Skeleton(props: SkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'variant']);

  return (
    <div
      data-slot="skeleton"
      class={cn(
        'rounded-xl',
        (local.variant ?? 'pulse') === 'pulse' && 'bg-muted animate-pulse',
        local.variant === 'shimmer' && 'skeleton-shimmer bg-muted relative overflow-hidden',
        'motion-reduce:animate-none',
        local.class
      )}
      {...others}
    />
  );
}

// ============================================
// Skeleton Card
// ============================================

interface SkeletonCardProps extends ComponentProps<'div'> {
  /** Animation delay for staggered reveals (ms) */
  delay?: number;
}

/**
 * Generic card skeleton with header and content placeholders.
 */
function SkeletonCard(props: SkeletonCardProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'delay']);

  return (
    <div
      data-slot="skeleton-card"
      class={cn(
        'border-border bg-card animate-pulse rounded-2xl border p-6',
        'motion-reduce:animate-none',
        local.class
      )}
      style={{ 'animation-delay': `${local.delay ?? 0}ms` }}
      {...others}
    >
      <div class="space-y-4">
        <Skeleton class="h-6 w-1/3" />
        <Skeleton class="h-4 w-2/3" />
        <div class="space-y-3 pt-4">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Chart Skeleton
// ============================================

interface ChartSkeletonProps extends ComponentProps<'div'> {
  /** Chart height in pixels */
  height?: number;
  /** Chart type for appropriate placeholder shape */
  chartType?: 'area' | 'bar' | 'line' | 'scatter';
  /** Show header placeholder */
  showHeader?: boolean;
  /** Show footer stats placeholder */
  showFooter?: boolean;
}

/**
 * Chart-specific skeleton with appropriate visual structure.
 * Matches the analytics widget loading patterns.
 */
function ChartSkeleton(props: ChartSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'class',
    'height',
    'chartType',
    'showHeader',
    'showFooter',
  ]);

  const height = () => local.height ?? 300;
  const chartType = () => local.chartType ?? 'area';
  const showHeader = () => local.showHeader ?? true;
  const showFooter = () => local.showFooter ?? true;

  return (
    <div
      data-slot="chart-skeleton"
      class={cn('border-border/50 bg-card overflow-hidden rounded-xl border', local.class)}
      {...others}
    >
      {/* Header */}
      {showHeader() && (
        <div class="border-border/50 flex items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <Skeleton class="h-4 w-4 rounded" variant="shimmer" />
            <Skeleton class="h-5 w-32" variant="shimmer" />
          </div>
          <Skeleton class="h-4 w-20" variant="shimmer" />
        </div>
      )}

      {/* Chart area */}
      <div class="p-4">
        <div class="relative overflow-hidden rounded-lg" style={{ height: `${height()}px` }}>
          {/* Y-axis placeholder */}
          <div class="absolute top-0 bottom-0 left-0 flex w-10 flex-col justify-between py-2">
            <Skeleton class="h-3 w-8" />
            <Skeleton class="h-3 w-6" />
            <Skeleton class="h-3 w-8" />
            <Skeleton class="h-3 w-5" />
            <Skeleton class="h-3 w-7" />
          </div>

          {/* Chart visualization placeholder */}
          <div class="ml-12 h-full">
            {chartType() === 'bar' && <BarChartPlaceholder />}
            {chartType() === 'area' && <AreaChartPlaceholder />}
            {chartType() === 'line' && <LineChartPlaceholder />}
            {chartType() === 'scatter' && <ScatterChartPlaceholder />}
          </div>

          {/* X-axis placeholder */}
          <div class="absolute right-0 bottom-0 left-12 flex justify-between px-2">
            <Skeleton class="h-3 w-8" />
            <Skeleton class="h-3 w-8" />
            <Skeleton class="h-3 w-8" />
            <Skeleton class="h-3 w-8" />
          </div>
        </div>

        {/* Footer stats */}
        {showFooter() && (
          <div class="border-border/50 mt-4 grid grid-cols-3 gap-4 border-t pt-4">
            <StatPlaceholder />
            <StatPlaceholder />
            <StatPlaceholder />
          </div>
        )}
      </div>
    </div>
  );
}

function BarChartPlaceholder(): JSX.Element {
  return (
    <div class="flex h-full items-end justify-around gap-2 pb-6">
      <Skeleton class="h-[45%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton class="h-[65%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton class="h-[35%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton class="h-[80%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton class="h-[55%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton class="h-[70%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton class="h-[40%] w-8 rounded-t-md" variant="shimmer" />
    </div>
  );
}

function AreaChartPlaceholder(): JSX.Element {
  const gradientId = createUniqueId();

  return (
    <div class="relative h-full pb-6">
      <svg
        class="text-muted h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.3" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d="M0,180 Q50,160 100,140 T200,100 T300,120 T400,80 V200 H0 Z"
          fill={`url(#${gradientId})`}
          class="animate-pulse"
        />
        <path
          d="M0,180 Q50,160 100,140 T200,100 T300,120 T400,80"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="animate-pulse"
        />
      </svg>
    </div>
  );
}

function LineChartPlaceholder(): JSX.Element {
  return (
    <div class="relative h-full pb-6">
      <svg
        class="text-muted h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,150 Q80,120 160,100 T320,80 T400,60"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-dasharray="8 4"
          class="animate-pulse"
        />
        {/* Data points */}
        <circle cx="0" cy="150" r="4" fill="currentColor" class="animate-pulse" />
        <circle cx="100" cy="110" r="4" fill="currentColor" class="animate-pulse" />
        <circle cx="200" cy="90" r="4" fill="currentColor" class="animate-pulse" />
        <circle cx="300" cy="75" r="4" fill="currentColor" class="animate-pulse" />
        <circle cx="400" cy="60" r="4" fill="currentColor" class="animate-pulse" />
      </svg>
    </div>
  );
}

function ScatterChartPlaceholder(): JSX.Element {
  return (
    <div class="relative h-full pb-6">
      <svg
        class="text-muted h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Scattered points */}
        <circle cx="50" cy="120" r="8" fill="currentColor" class="animate-pulse" />
        <circle cx="120" cy="80" r="8" fill="currentColor" class="animate-pulse" />
        <circle cx="180" cy="140" r="8" fill="currentColor" class="animate-pulse" />
        <circle cx="250" cy="60" r="8" fill="currentColor" class="animate-pulse" />
        <circle cx="320" cy="100" r="8" fill="currentColor" class="animate-pulse" />
        <circle cx="380" cy="40" r="8" fill="currentColor" class="animate-pulse" />
      </svg>
    </div>
  );
}

function StatPlaceholder(): JSX.Element {
  return (
    <div class="text-center">
      <Skeleton class="mx-auto mb-1.5 h-3 w-16" />
      <Skeleton class="mx-auto h-5 w-12" variant="shimmer" />
    </div>
  );
}

// ============================================
// Stat Card Skeleton
// ============================================

interface StatCardSkeletonProps extends ComponentProps<'div'> {
  /** Use compact size */
  compact?: boolean;
  /** Animation delay for staggered reveals (ms) */
  delay?: number;
}

/**
 * Skeleton for StatCard components.
 */
function StatCardSkeleton(props: StatCardSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['compact', 'delay', 'class']);

  return (
    <div
      data-slot="stat-card-skeleton"
      class={cn(
        'border-border bg-card rounded-xl border',
        local.compact ? 'p-4' : 'p-5',
        local.class
      )}
      style={{ 'animation-delay': `${local.delay ?? 0}ms` }}
      {...others}
    >
      <div class="flex items-center justify-between">
        <Skeleton class="h-3 w-16" />
        <Skeleton class="h-4 w-4 rounded" />
      </div>
      <Skeleton class={cn('mt-3', local.compact ? 'h-6 w-20' : 'h-8 w-24')} variant="shimmer" />
    </div>
  );
}

// ============================================
// Table Skeleton
// ============================================

interface TableSkeletonProps extends ComponentProps<'div'> {
  /** Number of rows to display */
  rows?: number;
  /** Number of columns to display */
  columns?: number;
  /** Show header row */
  showHeader?: boolean;
}

/**
 * Table-specific skeleton with header and data rows.
 */
function TableSkeleton(props: TableSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['rows', 'columns', 'showHeader', 'class']);

  const rows = () => local.rows ?? 5;
  const columns = () => local.columns ?? 4;
  const showHeader = () => local.showHeader ?? true;

  return (
    <div
      data-slot="table-skeleton"
      class={cn('border-border/50 bg-card overflow-hidden rounded-xl border', local.class)}
      {...others}
    >
      {/* Header */}
      {showHeader() && (
        <div class="border-border/50 flex gap-4 border-b px-4 py-3">
          <For each={Array.from({ length: columns() })}>
            {(_, i) => <Skeleton class={cn('h-4', i() === 0 ? 'w-1/4' : 'flex-1')} />}
          </For>
        </div>
      )}

      {/* Rows */}
      <div class="divide-border/50 divide-y">
        <For each={Array.from({ length: rows() })}>
          {(_, rowIndex) => (
            <div
              class="flex items-center gap-4 px-4 py-3"
              style={{ 'animation-delay': `${rowIndex() * 50}ms` }}
            >
              <For each={Array.from({ length: columns() })}>
                {(_, colIndex) => (
                  <Skeleton
                    class={cn(
                      'h-4',
                      colIndex() === 0 ? 'w-1/4' : 'flex-1',
                      rowIndex() % 2 === 0 ? 'opacity-100' : 'opacity-80'
                    )}
                    variant={colIndex() === 0 ? 'shimmer' : 'pulse'}
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// ============================================
// List Skeleton
// ============================================

interface ListSkeletonProps extends ComponentProps<'div'> {
  /** Number of items to display */
  items?: number;
  /** Show avatar/icon placeholder */
  showAvatar?: boolean;
  /** Show secondary text */
  showSecondary?: boolean;
}

/**
 * List-specific skeleton for item lists.
 */
function ListSkeleton(props: ListSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['items', 'showAvatar', 'showSecondary', 'class']);

  const items = () => local.items ?? 5;
  const showAvatar = () => local.showAvatar ?? true;
  const showSecondary = () => local.showSecondary ?? true;

  return (
    <div data-slot="list-skeleton" class={cn('space-y-3', local.class)} {...others}>
      <For each={Array.from({ length: items() })}>
        {(_, i) => (
          <div class="flex items-center gap-3" style={{ 'animation-delay': `${i() * 75}ms` }}>
            {showAvatar() && <Skeleton class="h-10 w-10 shrink-0 rounded-full" variant="shimmer" />}
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-3/4" />
              {showSecondary() && <Skeleton class="h-3 w-1/2" />}
            </div>
            <Skeleton class="h-4 w-16" variant="shimmer" />
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================
// Market Card Skeleton
// ============================================

interface MarketCardSkeletonProps extends ComponentProps<'div'> {
  /** Animation delay for staggered reveals (ms) */
  delay?: number;
}

/**
 * Market card-specific skeleton matching the MarketCard layout.
 */
function MarketCardSkeleton(props: MarketCardSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['delay', 'class']);

  return (
    <div
      data-slot="market-card-skeleton"
      class={cn('border-border bg-card overflow-hidden rounded-2xl border p-6', local.class)}
      style={{ 'animation-delay': `${local.delay ?? 0}ms` }}
      {...others}
    >
      {/* Header */}
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <Skeleton class="h-10 w-10 rounded-full" variant="shimmer" />
          <div class="space-y-2">
            <Skeleton class="h-5 w-24" />
            <Skeleton class="h-4 w-16" />
          </div>
        </div>
        <div class="space-y-1 text-right">
          <Skeleton class="ml-auto h-3 w-16" />
          <Skeleton class="ml-auto h-8 w-20" variant="shimmer" />
        </div>
      </div>

      {/* Yield bar */}
      <Skeleton class="mt-4 h-1.5 w-full rounded-full" />

      {/* Stats grid */}
      <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div class="flex justify-between">
          <Skeleton class="h-4 w-10" />
          <Skeleton class="h-4 w-16" />
        </div>
        <div class="flex justify-between">
          <Skeleton class="h-4 w-14" />
          <Skeleton class="h-4 w-12" />
        </div>
        <div class="flex justify-between">
          <Skeleton class="h-4 w-12" />
          <Skeleton class="h-4 w-8" />
        </div>
        <div class="flex justify-between">
          <Skeleton class="h-4 w-16" />
          <Skeleton class="h-4 w-14" />
        </div>
      </div>

      {/* Action buttons */}
      <div class="mt-4 flex gap-2">
        <Skeleton class="h-10 flex-1 rounded-lg" variant="shimmer" />
        <Skeleton class="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================
// Form Skeleton
// ============================================

interface FormSkeletonProps extends ComponentProps<'div'> {
  /** Number of input fields */
  fields?: number;
  /** Show submit button */
  showSubmit?: boolean;
}

/**
 * Form-specific skeleton for swap/mint forms.
 */
function FormSkeleton(props: FormSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['fields', 'showSubmit', 'class']);

  const fields = () => local.fields ?? 2;
  const showSubmit = () => local.showSubmit ?? true;

  return (
    <div
      data-slot="form-skeleton"
      class={cn('border-border bg-card space-y-4 rounded-2xl border p-6', local.class)}
      {...others}
    >
      {/* Toggle/tabs placeholder */}
      <div class="flex gap-2">
        <Skeleton class="h-9 w-16 rounded-lg" variant="shimmer" />
        <Skeleton class="h-9 w-16 rounded-lg" />
      </div>

      {/* Input fields */}
      <For each={Array.from({ length: fields() })}>
        {() => (
          <div class="bg-muted/30 space-y-3 rounded-xl p-4">
            <div class="flex items-center justify-between">
              <Skeleton class="h-3 w-12" />
              <Skeleton class="h-3 w-24" />
            </div>
            <div class="flex items-center gap-3">
              <Skeleton class="h-10 flex-1" />
              <Skeleton class="h-10 w-28 rounded-full" variant="shimmer" />
            </div>
          </div>
        )}
      </For>

      {/* Details section */}
      <div class="space-y-2 pt-2">
        <div class="flex justify-between">
          <Skeleton class="h-3 w-20" />
          <Skeleton class="h-3 w-16" />
        </div>
        <div class="flex justify-between">
          <Skeleton class="h-3 w-24" />
          <Skeleton class="h-3 w-12" />
        </div>
      </div>

      {/* Submit button */}
      {showSubmit() && <Skeleton class="h-12 w-full rounded-lg" variant="shimmer" />}
    </div>
  );
}

// ============================================
// Sparkline Skeleton
// ============================================

interface SparklineSkeletonProps extends ComponentProps<'div'> {
  /** Width of the sparkline */
  width?: number | string;
  /** Height of the sparkline */
  height?: number;
}

/**
 * Sparkline/mini-chart skeleton.
 */
function SparklineSkeleton(props: SparklineSkeletonProps): JSX.Element {
  const [local, others] = splitProps(props, ['width', 'height', 'class']);

  const width = () => local.width ?? '100%';
  const height = () => local.height ?? 40;

  return (
    <div
      data-slot="sparkline-skeleton"
      class={cn('overflow-hidden rounded', local.class)}
      style={{
        width: typeof width() === 'number' ? `${width()}px` : (width() as string),
        height: `${height()}px`,
      }}
      {...others}
    >
      <svg
        class="text-muted h-full w-full animate-pulse"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,30 Q15,25 30,20 T60,15 T100,10"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
      </svg>
    </div>
  );
}

// ============================================
// Hero Skeleton
// ============================================

interface HeroSkeletonProps {
  class?: string;
}

/**
 * Hero section skeleton for landing page loading state.
 */
function HeroSkeleton(props: HeroSkeletonProps): JSX.Element {
  return (
    <div
      data-slot="hero-skeleton"
      class={cn('flex min-h-[60vh] items-center justify-center px-4', props.class)}
    >
      <div class="w-full max-w-3xl space-y-6 text-center">
        <Skeleton class="mx-auto h-16 w-3/4" variant="shimmer" />
        <Skeleton class="mx-auto h-6 w-2/3" />
        <Skeleton class="mx-auto h-6 w-1/2" />

        {/* Stat orbs */}
        <div class="mt-12 flex justify-center gap-8">
          <div class="space-y-2 text-center">
            <Skeleton class="mx-auto h-4 w-12" />
            <Skeleton class="mx-auto h-8 w-20" variant="shimmer" />
          </div>
          <div class="space-y-2 text-center">
            <Skeleton class="mx-auto h-4 w-16" />
            <Skeleton class="mx-auto h-8 w-24" variant="shimmer" />
          </div>
          <div class="space-y-2 text-center">
            <Skeleton class="mx-auto h-4 w-14" />
            <Skeleton class="mx-auto h-8 w-16" variant="shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Staggered Skeleton Grid
// ============================================

interface SkeletonGridProps extends ComponentProps<'div'> {
  /** Number of items */
  count?: number;
  /** Skeleton component to render */
  skeleton?: Component<{ delay?: number; class?: string }>;
  /** Stagger delay between items (ms) */
  staggerDelay?: number;
  /** Grid columns */
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
}

/**
 * Grid of skeleton items with staggered animation.
 */
function SkeletonGrid(props: SkeletonGridProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'count',
    'skeleton',
    'staggerDelay',
    'columns',
    'class',
  ]);

  const count = () => local.count ?? 4;
  const SkeletonComponent = local.skeleton ?? MarketCardSkeleton;
  const staggerDelay = () => local.staggerDelay ?? 75;
  const columns = () => local.columns ?? { default: 1, sm: 2, lg: 4 };

  return (
    <div
      data-slot="skeleton-grid"
      class={cn(
        'grid gap-4',
        columns().default === 1 && 'grid-cols-1',
        columns().default === 2 && 'grid-cols-2',
        columns().default === 3 && 'grid-cols-3',
        columns().default === 4 && 'grid-cols-4',
        columns().sm === 2 && 'sm:grid-cols-2',
        columns().sm === 3 && 'sm:grid-cols-3',
        columns().sm === 4 && 'sm:grid-cols-4',
        columns().md === 2 && 'md:grid-cols-2',
        columns().md === 3 && 'md:grid-cols-3',
        columns().md === 4 && 'md:grid-cols-4',
        columns().lg === 2 && 'lg:grid-cols-2',
        columns().lg === 3 && 'lg:grid-cols-3',
        columns().lg === 4 && 'lg:grid-cols-4',
        local.class
      )}
      {...others}
    >
      <For each={Array.from({ length: count() })}>
        {(_, i) => <SkeletonComponent delay={i() * staggerDelay()} />}
      </For>
    </div>
  );
}

export {
  ChartSkeleton,
  FormSkeleton,
  HeroSkeleton,
  ListSkeleton,
  MarketCardSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonGrid,
  SparklineSkeleton,
  StatCardSkeleton,
  TableSkeleton,
};

export type {
  ChartSkeletonProps,
  FormSkeletonProps,
  HeroSkeletonProps,
  ListSkeletonProps,
  MarketCardSkeletonProps,
  SkeletonCardProps,
  SkeletonGridProps,
  SkeletonProps,
  SparklineSkeletonProps,
  StatCardSkeletonProps,
  TableSkeletonProps,
};
