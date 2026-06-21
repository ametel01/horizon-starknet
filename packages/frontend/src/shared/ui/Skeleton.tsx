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
            <Skeleton className="size-4 rounded" variant="shimmer" />
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
        <Skeleton className="size-4 rounded" />
      </div>
      <Skeleton className={cn('mt-3', compact ? 'h-6 w-20' : 'h-8 w-24')} variant="shimmer" />
    </div>
  );
}

// ============================================
// Table Skeleton
// ============================================
// ============================================
// List Skeleton
// ============================================
// ============================================
// Market Card Skeleton
// ============================================
// ============================================
// Form Skeleton
// ============================================
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
// ============================================
// Staggered Skeleton Grid
// ============================================
export { ChartSkeleton, Skeleton, SkeletonCard, SparklineSkeleton, StatCardSkeleton };
