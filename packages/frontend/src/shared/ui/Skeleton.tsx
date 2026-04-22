'use client';

import { cn } from '@shared/lib/utils';
import type * as React from 'react';

// ============================================
// Base Skeleton
// ============================================

interface SkeletonProps extends React.ComponentProps<'div'> {
  /** Shimmer variant: default pulse or warm gradient shimmer */
  variant?: 'pulse' | 'shimmer';
}

/**
 * Base skeleton loading placeholder with optional warm shimmer effect.
 * Uses the Horizon amber theme for a distinctive loading experience.
 */
function Skeleton({ className, variant = 'pulse', ...props }: SkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-xl',
        variant === 'pulse' && 'bg-muted animate-pulse',
        variant === 'shimmer' && 'skeleton-shimmer bg-muted relative overflow-hidden',
        'motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  );
}

// ============================================
// Skeleton Card
// ============================================

interface SkeletonCardProps extends React.ComponentProps<'div'> {
  /** Animation delay for staggered reveals (ms) */
  delay?: number;
}

/**
 * Generic card skeleton with header and content placeholders.
 */
function SkeletonCard({ className, delay = 0, ...props }: SkeletonCardProps): React.JSX.Element {
  return (
    <div
      data-slot="skeleton-card"
      className={cn(
        'border-border bg-card animate-pulse rounded-2xl border p-6',
        'motion-reduce:animate-none',
        className
      )}
      style={{ animationDelay: `${String(delay)}ms` }}
      {...props}
    >
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Chart Skeleton
// ============================================

interface ChartSkeletonProps extends React.ComponentProps<'div'> {
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
function ChartSkeleton({
  className,
  height = 300,
  chartType = 'area',
  showHeader = true,
  showFooter = true,
  ...props
}: ChartSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="chart-skeleton"
      className={cn('border-border/50 bg-card overflow-hidden rounded-xl border', className)}
      {...props}
    >
      {/* Header */}
      {showHeader && (
        <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" variant="shimmer" />
            <Skeleton className="h-5 w-32" variant="shimmer" />
          </div>
          <Skeleton className="h-4 w-20" variant="shimmer" />
        </div>
      )}

      {/* Chart area */}
      <div className="p-4">
        <div className="relative overflow-hidden rounded-lg" style={{ height }}>
          {/* Y-axis placeholder */}
          <div className="absolute top-0 bottom-0 left-0 flex w-10 flex-col justify-between py-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-5" />
            <Skeleton className="h-3 w-7" />
          </div>

          {/* Chart visualization placeholder */}
          <div className="ml-12 h-full">
            {chartType === 'bar' && <BarChartPlaceholder />}
            {chartType === 'area' && <AreaChartPlaceholder />}
            {chartType === 'line' && <LineChartPlaceholder />}
            {chartType === 'scatter' && <ScatterChartPlaceholder />}
          </div>

          {/* X-axis placeholder */}
          <div className="absolute right-0 bottom-0 left-12 flex justify-between px-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>

        {/* Footer stats */}
        {showFooter && (
          <div className="border-border/50 mt-4 grid grid-cols-3 gap-4 border-t pt-4">
            <StatPlaceholder />
            <StatPlaceholder />
            <StatPlaceholder />
          </div>
        )}
      </div>
    </div>
  );
}

function BarChartPlaceholder(): React.JSX.Element {
  return (
    <div className="flex h-full items-end justify-around gap-2 pb-6">
      <Skeleton className="h-[45%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton className="h-[65%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton className="h-[35%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton className="h-[80%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton className="h-[55%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton className="h-[70%] w-8 rounded-t-md" variant="shimmer" />
      <Skeleton className="h-[40%] w-8 rounded-t-md" variant="shimmer" />
    </div>
  );
}

function AreaChartPlaceholder(): React.JSX.Element {
  return (
    <div className="relative h-full pb-6">
      <svg className="text-muted h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d="M0,180 Q50,160 100,140 T200,100 T300,120 T400,80 V200 H0 Z"
          fill="url(#areaGradient)"
          className="animate-pulse"
        />
        <path
          d="M0,180 Q50,160 100,140 T200,100 T300,120 T400,80"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    </div>
  );
}

function LineChartPlaceholder(): React.JSX.Element {
  return (
    <div className="relative h-full pb-6">
      <svg className="text-muted h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path
          d="M0,150 Q80,120 160,100 T320,80 T400,60"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="8 4"
          className="animate-pulse"
        />
        {/* Data points */}
        <circle cx="0" cy="150" r="4" fill="currentColor" className="animate-pulse" />
        <circle cx="100" cy="110" r="4" fill="currentColor" className="animate-pulse" />
        <circle cx="200" cy="90" r="4" fill="currentColor" className="animate-pulse" />
        <circle cx="300" cy="75" r="4" fill="currentColor" className="animate-pulse" />
        <circle cx="400" cy="60" r="4" fill="currentColor" className="animate-pulse" />
      </svg>
    </div>
  );
}

function ScatterChartPlaceholder(): React.JSX.Element {
  return (
    <div className="relative h-full pb-6">
      <svg className="text-muted h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        {/* Scattered points */}
        <circle cx="50" cy="120" r="8" fill="currentColor" className="animate-pulse" />
        <circle cx="120" cy="80" r="8" fill="currentColor" className="animate-pulse" />
        <circle cx="180" cy="140" r="8" fill="currentColor" className="animate-pulse" />
        <circle cx="250" cy="60" r="8" fill="currentColor" className="animate-pulse" />
        <circle cx="320" cy="100" r="8" fill="currentColor" className="animate-pulse" />
        <circle cx="380" cy="40" r="8" fill="currentColor" className="animate-pulse" />
      </svg>
    </div>
  );
}

function StatPlaceholder(): React.JSX.Element {
  return (
    <div className="text-center">
      <Skeleton className="mx-auto mb-1.5 h-3 w-16" />
      <Skeleton className="mx-auto h-5 w-12" variant="shimmer" />
    </div>
  );
}

// ============================================
// Stat Card Skeleton
// ============================================

interface StatCardSkeletonProps extends React.ComponentProps<'div'> {
  /** Use compact size */
  compact?: boolean;
  /** Animation delay for staggered reveals (ms) */
  delay?: number;
}

/**
 * Skeleton for StatCard components.
 */
function StatCardSkeleton({
  compact = false,
  delay = 0,
  className,
  ...props
}: StatCardSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="stat-card-skeleton"
      className={cn('border-border bg-card rounded-xl border', compact ? 'p-4' : 'p-5', className)}
      style={{ animationDelay: `${String(delay)}ms` }}
      {...props}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className={cn('mt-3', compact ? 'h-6 w-20' : 'h-8 w-24')} variant="shimmer" />
    </div>
  );
}

// ============================================
// Table Skeleton
// ============================================

interface TableSkeletonProps extends React.ComponentProps<'div'> {
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
function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
  ...props
}: TableSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="table-skeleton"
      className={cn('border-border/50 bg-card overflow-hidden rounded-xl border', className)}
      {...props}
    >
      {/* Header */}
      {showHeader && (
        <div className="border-border/50 flex gap-4 border-b px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      )}

      {/* Rows */}
      <div className="divide-border/50 divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 px-4 py-3"
            style={{ animationDelay: `${String(rowIndex * 50)}ms` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  'h-4',
                  colIndex === 0 ? 'w-1/4' : 'flex-1',
                  rowIndex % 2 === 0 ? 'opacity-100' : 'opacity-80'
                )}
                variant={colIndex === 0 ? 'shimmer' : 'pulse'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// List Skeleton
// ============================================

interface ListSkeletonProps extends React.ComponentProps<'div'> {
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
function ListSkeleton({
  items = 5,
  showAvatar = true,
  showSecondary = true,
  className,
  ...props
}: ListSkeletonProps): React.JSX.Element {
  return (
    <div data-slot="list-skeleton" className={cn('space-y-3', className)} {...props}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3"
          style={{ animationDelay: `${String(i * 75)}ms` }}
        >
          {showAvatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" variant="shimmer" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            {showSecondary && <Skeleton className="h-3 w-1/2" />}
          </div>
          <Skeleton className="h-4 w-16" variant="shimmer" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Market Card Skeleton
// ============================================

interface MarketCardSkeletonProps extends React.ComponentProps<'div'> {
  /** Animation delay for staggered reveals (ms) */
  delay?: number;
}

/**
 * Market card-specific skeleton matching the MarketCard layout.
 */
function MarketCardSkeleton({
  delay = 0,
  className,
  ...props
}: MarketCardSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="market-card-skeleton"
      className={cn('border-border bg-card overflow-hidden rounded-2xl border p-6', className)}
      style={{ animationDelay: `${String(delay)}ms` }}
      {...props}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" variant="shimmer" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="ml-auto h-8 w-20" variant="shimmer" />
        </div>
      </div>

      {/* Yield bar */}
      <Skeleton className="mt-4 h-1.5 w-full rounded-full" />

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" variant="shimmer" />
        <Skeleton className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================
// Form Skeleton
// ============================================

interface FormSkeletonProps extends React.ComponentProps<'div'> {
  /** Number of input fields */
  fields?: number;
  /** Show submit button */
  showSubmit?: boolean;
}

/**
 * Form-specific skeleton for swap/mint forms.
 */
function FormSkeleton({
  fields = 2,
  showSubmit = true,
  className,
  ...props
}: FormSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="form-skeleton"
      className={cn('border-border bg-card space-y-4 rounded-2xl border p-6', className)}
      {...props}
    >
      {/* Toggle/tabs placeholder */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16 rounded-lg" variant="shimmer" />
        <Skeleton className="h-9 w-16 rounded-lg" />
      </div>

      {/* Input fields */}
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="bg-muted/30 space-y-3 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-28 rounded-full" variant="shimmer" />
          </div>
        </div>
      ))}

      {/* Details section */}
      <div className="space-y-2 pt-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Submit button */}
      {showSubmit && <Skeleton className="h-12 w-full rounded-lg" variant="shimmer" />}
    </div>
  );
}

// ============================================
// Sparkline Skeleton
// ============================================

interface SparklineSkeletonProps extends React.ComponentProps<'div'> {
  /** Width of the sparkline */
  width?: number | string;
  /** Height of the sparkline */
  height?: number;
}

/**
 * Sparkline/mini-chart skeleton.
 */
function SparklineSkeleton({
  width = '100%',
  height = 40,
  className,
  ...props
}: SparklineSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="sparkline-skeleton"
      className={cn('overflow-hidden rounded', className)}
      style={{
        width: typeof width === 'number' ? `${String(width)}px` : width,
        height,
      }}
      {...props}
    >
      <svg
        className="text-muted h-full w-full animate-pulse"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
      >
        <path
          d="M0,30 Q15,25 30,20 T60,15 T100,10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

// ============================================
// Hero Skeleton
// ============================================

/**
 * Hero section skeleton for landing page loading state.
 */
function HeroSkeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      data-slot="hero-skeleton"
      className={cn('flex min-h-[60vh] items-center justify-center px-4', className)}
    >
      <div className="w-full max-w-3xl space-y-6 text-center">
        <Skeleton className="mx-auto h-16 w-3/4" variant="shimmer" />
        <Skeleton className="mx-auto h-6 w-2/3" />
        <Skeleton className="mx-auto h-6 w-1/2" />

        {/* Stat orbs */}
        <div className="mt-12 flex justify-center gap-8">
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-4 w-12" />
            <Skeleton className="mx-auto h-8 w-20" variant="shimmer" />
          </div>
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-4 w-16" />
            <Skeleton className="mx-auto h-8 w-24" variant="shimmer" />
          </div>
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-4 w-14" />
            <Skeleton className="mx-auto h-8 w-16" variant="shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Staggered Skeleton Grid
// ============================================

interface SkeletonGridProps extends React.ComponentProps<'div'> {
  /** Number of items */
  count?: number;
  /** Skeleton component to render */
  skeleton?: React.ComponentType<{ delay?: number; className?: string }>;
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
function SkeletonGrid({
  count = 4,
  skeleton: SkeletonComponent = MarketCardSkeleton,
  staggerDelay = 75,
  columns = { default: 1, sm: 2, lg: 4 },
  className,
  ...props
}: SkeletonGridProps): React.JSX.Element {
  return (
    <div
      data-slot="skeleton-grid"
      className={cn(
        'grid gap-4',
        columns.default === 1 && 'grid-cols-1',
        columns.default === 2 && 'grid-cols-2',
        columns.default === 3 && 'grid-cols-3',
        columns.default === 4 && 'grid-cols-4',
        columns.sm === 2 && 'sm:grid-cols-2',
        columns.sm === 3 && 'sm:grid-cols-3',
        columns.sm === 4 && 'sm:grid-cols-4',
        columns.md === 2 && 'md:grid-cols-2',
        columns.md === 3 && 'md:grid-cols-3',
        columns.md === 4 && 'md:grid-cols-4',
        columns.lg === 2 && 'lg:grid-cols-2',
        columns.lg === 3 && 'lg:grid-cols-3',
        columns.lg === 4 && 'lg:grid-cols-4',
        className
      )}
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} delay={i * staggerDelay} />
      ))}
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
