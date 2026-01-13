import { cn } from '@shared/lib/utils';
import { type JSX, splitProps } from 'solid-js';

/**
 * Typography Components for Horizon Protocol (SolidJS)
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
  children: JSX.Element;
  class?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'div';
}

/**
 * Hero heading - largest display text for page titles
 * Uses Instrument Serif with elegant letter spacing
 */
function Heading(props: HeadingProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class', 'as']);
  const Tag = local.as ?? 'h1';

  return (
    <Tag class={cn('font-display tracking-tight', local.class)} {...others}>
      {local.children}
    </Tag>
  );
}

interface DisplayProps {
  children: JSX.Element;
  class?: string;
}

/**
 * Display text - for hero sections and prominent callouts
 */
function Display(props: DisplayProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class']);

  return (
    <span
      class={cn(
        'font-display text-4xl font-normal tracking-tight md:text-5xl lg:text-6xl',
        local.class
      )}
      {...others}
    >
      {local.children}
    </span>
  );
}

// ============================================
// Metric Typography (JetBrains Mono)
// ============================================

interface MetricProps {
  children: JSX.Element;
  class?: string | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero' | undefined;
  variant?: 'default' | 'positive' | 'negative' | 'muted' | undefined;
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
function Metric(props: MetricProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class', 'size', 'variant']);
  const size = () => local.size ?? 'md';
  const variant = () => local.variant ?? 'default';

  // Hero size uses special gradient styling from CSS
  if (size() === 'hero') {
    return (
      <span class={cn('metric-hero', local.class)} {...others}>
        {local.children}
      </span>
    );
  }

  return (
    <span
      class={cn('metric', metricSizes[size()], metricVariants[variant()], local.class)}
      {...others}
    >
      {local.children}
    </span>
  );
}

/**
 * APY display component with appropriate formatting
 */
interface ApyMetricProps {
  value: number;
  class?: string;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

function ApyMetric(props: ApyMetricProps): JSX.Element {
  const [local, others] = splitProps(props, ['value', 'class', 'showSign', 'size']);
  const showSign = () => local.showSign ?? false;
  const size = () => local.size ?? 'lg';

  const formatted = () => {
    const sign = showSign() && local.value > 0 ? '+' : '';
    return `${sign}${(local.value * 100).toFixed(2)}%`;
  };

  const variant = () => {
    if (local.value > 0) return 'positive';
    if (local.value < 0) return 'negative';
    return 'default';
  };

  return (
    <Metric size={size()} variant={variant()} class={local.class} {...others}>
      {formatted()}
    </Metric>
  );
}

// ============================================
// Label Typography
// ============================================

interface LabelTextProps {
  children: JSX.Element;
  class?: string;
}

/**
 * Label text for form labels, stat card headers, etc.
 * Small, uppercase, with letter spacing
 */
function LabelText(props: LabelTextProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class']);

  return (
    <span class={cn('label', local.class)} {...others}>
      {local.children}
    </span>
  );
}

// ============================================
// Address/Hash Typography
// ============================================

interface AddressDisplayProps {
  address: string;
  class?: string;
  truncate?: boolean;
  chars?: number;
}

/**
 * Address display component for blockchain addresses
 * Uses monospace font with optional truncation
 */
function AddressDisplay(props: AddressDisplayProps): JSX.Element {
  const [local, others] = splitProps(props, ['address', 'class', 'truncate', 'chars']);
  const shouldTruncate = () => local.truncate ?? true;
  const chars = () => local.chars ?? 6;

  const displayAddress = () => {
    if (shouldTruncate()) {
      return `${local.address.slice(0, chars())}...${local.address.slice(-4)}`;
    }
    return local.address;
  };

  return (
    <span class={cn('address', local.class)} title={local.address} {...others}>
      {displayAddress()}
    </span>
  );
}

// ============================================
// Data Typography
// ============================================

interface DataTextProps {
  children: JSX.Element;
  class?: string;
}

/**
 * Data text for tables, lists, and dense UI
 * Monospace with tabular numbers
 */
function DataText(props: DataTextProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class']);

  return (
    <span class={cn('text-data', local.class)} {...others}>
      {local.children}
    </span>
  );
}

// ============================================
// Gradient Text
// ============================================

interface GradientTextProps {
  children: JSX.Element;
  class?: string;
}

/**
 * Gradient text using the primary color gradient
 * For emphasis on key values or headings
 */
function GradientText(props: GradientTextProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class']);

  return (
    <span class={cn('text-gradient-primary', local.class)} {...others}>
      {local.children}
    </span>
  );
}

// ============================================
// Stat Display Component
// ============================================

interface StatDisplayProps {
  label: string;
  value: string | JSX.Element;
  subValue?: string;
  class?: string;
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
function StatDisplay(props: StatDisplayProps): JSX.Element {
  const [local, others] = splitProps(props, ['label', 'value', 'subValue', 'class', 'size']);
  const size = () => local.size ?? 'md';
  const sizes = () => statSizes[size()];

  return (
    <div class={cn('space-y-1', local.class)} {...others}>
      <div class={cn('label', sizes().label)}>{local.label}</div>
      <div class={cn('metric font-semibold', sizes().value)}>{local.value}</div>
      {local.subValue !== undefined && (
        <div class={cn('text-muted-foreground', sizes().sub)}>{local.subValue}</div>
      )}
    </div>
  );
}

export {
  Heading,
  Display,
  Metric,
  ApyMetric,
  LabelText,
  AddressDisplay,
  DataText,
  GradientText,
  StatDisplay,
};

export type {
  HeadingProps,
  DisplayProps,
  MetricProps,
  ApyMetricProps,
  LabelTextProps,
  AddressDisplayProps,
  DataTextProps,
  GradientTextProps,
  StatDisplayProps,
};
