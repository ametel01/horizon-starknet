'use client';

import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

/**
 * Typography Components for Horizon Protocol
 *
 * These components provide semantic typography with the new font system:
 * - Display: Instrument Serif (elegant headlines)
 * - Body: Outfit (modern geometric sans)
 * - Mono: JetBrains Mono (data, numbers, addresses)
 */

// ============================================
// Display Typography (Instrument Serif)
// ============================================

interface HeadingProps {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'div';
}

/**
 * Hero heading - largest display text for page titles
 * Uses Instrument Serif with elegant letter spacing
 */
export function Heading({ children, className, as: Tag = 'h1' }: HeadingProps): ReactNode {
  return <Tag className={cn('font-display tracking-tight', className)}>{children}</Tag>;
}

/**
 * Display text - for hero sections and prominent callouts
 */
export function Display({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        'font-display text-4xl font-normal tracking-tight md:text-5xl lg:text-6xl',
        className
      )}
    >
      {children}
    </span>
  );
}

// ============================================
// Metric Typography (JetBrains Mono)
// ============================================

interface MetricProps {
  children: ReactNode;
  className?: string | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  variant?: 'default' | 'positive' | 'negative' | 'muted';
}

const metricSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
  hero: 'metric-hero', // Uses the CSS utility class
} as const;

const metricVariants = {
  default: 'text-foreground',
  positive: 'metric-positive',
  negative: 'metric-negative',
  muted: 'text-muted-foreground',
} as const;

/**
 * Metric component for displaying numbers, APY, amounts, etc.
 * Uses JetBrains Mono with tabular numbers for alignment
 */
export function Metric({
  children,
  className,
  size = 'md',
  variant = 'default',
}: MetricProps): ReactNode {
  // Hero size uses special gradient styling from CSS
  if (size === 'hero') {
    return <span className={cn('metric-hero', className)}>{children}</span>;
  }

  return (
    <span className={cn('metric', metricSizes[size], metricVariants[variant], className)}>
      {children}
    </span>
  );
}

/**
 * APY display component with appropriate formatting
 */
interface ApyMetricProps {
  value: number;
  className?: string;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

export function ApyMetric({
  value,
  className,
  showSign = false,
  size = 'lg',
}: ApyMetricProps): ReactNode {
  const formatted = `${showSign && value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  const variant = value > 0 ? 'positive' : value < 0 ? 'negative' : 'default';

  return (
    <Metric size={size} variant={variant} className={className}>
      {formatted}
    </Metric>
  );
}

// ============================================
// Label Typography
// ============================================

interface LabelTextProps {
  children: ReactNode;
  className?: string;
}

/**
 * Label text for form labels, stat card headers, etc.
 * Small, uppercase, with letter spacing
 */
export function LabelText({ children, className }: LabelTextProps): ReactNode {
  return <span className={cn('label', className)}>{children}</span>;
}

// ============================================
// Address/Hash Typography
// ============================================

interface AddressDisplayProps {
  address: string;
  className?: string;
  truncate?: boolean;
  chars?: number;
}

/**
 * Address display component for blockchain addresses
 * Uses monospace font with optional truncation
 */
export function AddressDisplay({
  address,
  className,
  truncate = true,
  chars = 6,
}: AddressDisplayProps): ReactNode {
  const displayAddress = truncate ? `${address.slice(0, chars)}...${address.slice(-4)}` : address;

  return (
    <span className={cn('address', className)} title={address}>
      {displayAddress}
    </span>
  );
}

// ============================================
// Data Typography
// ============================================

interface DataTextProps {
  children: ReactNode;
  className?: string;
}

/**
 * Data text for tables, lists, and dense UI
 * Monospace with tabular numbers
 */
export function DataText({ children, className }: DataTextProps): ReactNode {
  return <span className={cn('text-data', className)}>{children}</span>;
}

// ============================================
// Gradient Text
// ============================================

interface GradientTextProps {
  children: ReactNode;
  className?: string;
}

/**
 * Gradient text using the primary color gradient
 * For emphasis on key values or headings
 */
export function GradientText({ children, className }: GradientTextProps): ReactNode {
  return <span className={cn('text-gradient-primary', className)}>{children}</span>;
}

// ============================================
// Stat Display Component
// ============================================

interface StatDisplayProps {
  label: string;
  value: string | ReactNode;
  subValue?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statSizes = {
  sm: {
    label: 'text-xs',
    value: 'text-lg',
    sub: 'text-xs',
  },
  md: {
    label: 'text-xs',
    value: 'text-2xl',
    sub: 'text-xs',
  },
  lg: {
    label: 'text-sm',
    value: 'text-3xl',
    sub: 'text-sm',
  },
} as const;

/**
 * Stat display for dashboard cards and metrics
 * Combines label with metric value
 */
export function StatDisplay({
  label,
  value,
  subValue,
  className,
  size = 'md',
}: StatDisplayProps): ReactNode {
  const sizes = statSizes[size];

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('label', sizes.label)}>{label}</div>
      <div className={cn('metric font-semibold', sizes.value)}>{value}</div>
      {subValue !== undefined && (
        <div className={cn('text-muted-foreground', sizes.sub)}>{subValue}</div>
      )}
    </div>
  );
}
