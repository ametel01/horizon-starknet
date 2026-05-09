'use client';

import { cn } from '@shared/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { AnimatedNumber } from './AnimatedNumber';
import { Card, CardContent } from './Card';
import { Skeleton } from './Skeleton';

/**
 * Trend display configuration using decision table pattern.
 */
type TrendDirection = 'up' | 'down' | 'neutral';

const TREND_CONFIG: Record<TrendDirection, { icon: LucideIcon; className: string }> = {
  up: { icon: ArrowUp, className: 'text-green-500' },
  down: { icon: ArrowDown, className: 'text-red-500' },
  neutral: { icon: Minus, className: 'text-muted-foreground' },
};

function getTrendConfig(
  trend: TrendDirection | undefined
): { icon: LucideIcon; className: string } | null {
  if (trend === undefined) return null;
  return TREND_CONFIG[trend];
}

export interface StatCardProps {
  /** Label text displayed above the value */
  label: string;
  /** Main value to display (string, or use numericValue for animation) */
  value?: string | undefined;
  /** Numeric value for animated display */
  numericValue?: number | undefined;
  /** Formatter for numeric value */
  valueFormatter?: ((value: number) => string) | undefined;
  /** Optional delta change (e.g., "+12.4%", "-5%") */
  delta?: string | undefined;
  /** Trend direction for coloring the delta */
  trend?: 'up' | 'down' | 'neutral' | undefined;
  /** Optional icon to display in the top-right */
  icon?: ReactNode;
  /** Use compact padding and smaller text */
  compact?: boolean | undefined;
  /** Loading state */
  isLoading?: boolean | undefined;
  /** Additional CSS classes */
  className?: string | undefined;
  /** Animation delay in ms for staggered reveals */
  animationDelay?: number | undefined;
}

/**
 * StatCard - Enhanced stat display with motion and visual feedback
 *
 * Features:
 * - Subtle hover glow effect
 * - Trend indicators with color coding
 * - Staggered fade-in animation
 * - Respects prefers-reduced-motion
 * - Compact variant for dense layouts
 */
export function StatCard({
  label,
  value,
  numericValue,
  valueFormatter,
  delta,
  trend,
  icon,
  compact = false,
  isLoading = false,
  className,
  animationDelay = 0,
}: StatCardProps): ReactNode {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Trigger animation after mount with optional delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);
    return () => {
      clearTimeout(timer);
    };
  }, [animationDelay]);

  // Get trend configuration using decision table
  const trendConfig = getTrendConfig(trend);

  return (
    <Card
      ref={cardRef}
      className={cn(
        'group relative overflow-hidden transition-all duration-300',
        // Fade-in animation
        'translate-y-2 opacity-0',
        isVisible && 'translate-y-0 opacity-100',
        // Motion preference
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        className
      )}
      style={{
        transitionDelay: `${String(animationDelay)}ms`,
      }}
    >
      {/* Subtle glow on hover */}
      <div
        className="from-primary/0 to-primary/0 group-hover:from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent transition-all duration-500 group-hover:to-transparent"
        aria-hidden="true"
      />

      <CardContent className={cn('relative', compact ? 'p-4' : 'p-5')}>
        {/* Header with label and optional icon */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {label}
          </span>
          {icon !== undefined && <div className="text-primary/50">{icon}</div>}
        </div>

        {/* Value and delta */}
        {isLoading ? (
          <div className="mt-2">
            <Skeleton className={cn('w-24', compact ? 'h-7' : 'h-9')} />
          </div>
        ) : (
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                'font-mono font-semibold tracking-tight',
                compact ? 'text-xl' : 'text-2xl'
              )}
            >
              {numericValue !== undefined ? (
                <AnimatedNumber
                  value={numericValue}
                  formatter={valueFormatter ?? ((v) => v.toLocaleString())}
                  duration={600}
                  delay={animationDelay}
                />
              ) : (
                value
              )}
            </span>

            {delta !== undefined && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-sm font-medium',
                  trendConfig?.className ?? 'text-muted-foreground'
                )}
              >
                {trendConfig !== null && <trendConfig.icon className="size-3" />}
                {delta}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface StatCardGridProps {
  children: ReactNode;
  /** Number of columns on different breakpoints */
  columns?: {
    default?: number | undefined;
    sm?: number | undefined;
    md?: number | undefined;
    lg?: number | undefined;
  };
  /** Stagger delay between cards in ms */
  staggerDelay?: number | undefined;
  className?: string | undefined;
}

/**
 * StatCardGrid - Container for stat cards with staggered animations
 *
 * Automatically applies animation delays to child StatCards
 */
export function StatCardGrid({
  children,
  columns = { default: 1, sm: 2, lg: 4 },
  staggerDelay: _staggerDelay = 50,
  className,
}: StatCardGridProps): ReactNode {
  return (
    <div
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
        columns.lg === 5 && 'lg:grid-cols-5',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Skeleton version of StatCard for loading states
 */
export function StatCardSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean | undefined;
  className?: string | undefined;
}): ReactNode {
  return (
    <Card className={className}>
      <CardContent className={cn(compact ? 'p-4' : 'p-5')}>
        <Skeleton className="h-3 w-16" />
        <Skeleton className={cn('mt-3 w-24', compact ? 'h-6' : 'h-8')} />
      </CardContent>
    </Card>
  );
}
