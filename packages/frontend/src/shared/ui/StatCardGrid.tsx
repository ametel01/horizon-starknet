'use client';

import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

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
