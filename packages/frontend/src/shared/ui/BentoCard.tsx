'use client';

import { cn } from '@shared/lib/utils';
import { type ReactNode, useEffect, useState } from 'react';

export interface BentoCardProps {
  children: ReactNode;
  /** Column span on different breakpoints */
  colSpan?: {
    default?: number | undefined;
    sm?: number | undefined;
    md?: number | undefined;
    lg?: number | undefined;
  };
  /** Row span */
  rowSpan?: number | undefined;
  /** Additional CSS classes */
  className?: string | undefined;
  /** Animation delay for staggered reveal */
  animationDelay?: number | undefined;
  /** Whether this is a featured/hero card */
  featured?: boolean | undefined;
}

/**
 * BentoCard - Container for bento grid items with consistent styling
 *
 * Features:
 * - Responsive column/row spanning
 * - Subtle hover glow effect
 * - Staggered fade-in animation
 * - Featured variant with accent border
 */
export function BentoCard({
  children,
  colSpan = { default: 12 },
  rowSpan = 1,
  className,
  animationDelay = 0,
  featured = false,
}: BentoCardProps): ReactNode {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);
    return () => {
      clearTimeout(timer);
    };
  }, [animationDelay]);

  return (
    <div
      className={cn(
        // Base styles
        'group relative overflow-hidden rounded-xl border transition-all duration-300',
        'bg-card',
        // Border styling
        featured ? 'border-primary/30' : 'border-border/50',
        // Hover effects
        'hover:border-border hover:shadow-lg hover:shadow-black/5',
        // Animation
        'translate-y-2 opacity-0',
        isVisible && 'translate-y-0 opacity-100',
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        // Column spans
        colSpan.default === 1 && 'col-span-1',
        colSpan.default === 2 && 'col-span-2',
        colSpan.default === 3 && 'col-span-3',
        colSpan.default === 4 && 'col-span-4',
        colSpan.default === 6 && 'col-span-6',
        colSpan.default === 8 && 'col-span-8',
        colSpan.default === 12 && 'col-span-12',
        colSpan.sm === 4 && 'sm:col-span-4',
        colSpan.sm === 6 && 'sm:col-span-6',
        colSpan.md === 4 && 'md:col-span-4',
        colSpan.md === 6 && 'md:col-span-6',
        colSpan.md === 8 && 'md:col-span-8',
        colSpan.lg === 4 && 'lg:col-span-4',
        colSpan.lg === 6 && 'lg:col-span-6',
        colSpan.lg === 8 && 'lg:col-span-8',
        // Row spans
        rowSpan === 1 && 'row-span-1',
        rowSpan === 2 && 'row-span-2',
        rowSpan === 3 && 'row-span-3',
        className
      )}
      style={{
        transitionDelay: `${String(animationDelay)}ms`,
      }}
    >
      {/* Subtle glow on hover */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent transition-all duration-500',
          featured
            ? 'from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent'
            : 'from-white/0 to-white/0 group-hover:from-white/[0.02] group-hover:to-transparent'
        )}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

export interface BentoGridProps {
  children: ReactNode;
  className?: string | undefined;
}

/**
 * BentoGrid - 12-column grid container for bento layouts
 */
export function BentoGrid({ children, className }: BentoGridProps): ReactNode {
  return (
    <div className={cn('grid auto-rows-[minmax(120px,auto)] grid-cols-12 gap-4', className)}>
      {children}
    </div>
  );
}
