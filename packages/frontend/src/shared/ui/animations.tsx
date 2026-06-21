'use client';

import { cn } from '@shared/lib/utils';
import { isValidElement, type ReactNode } from 'react';

// ============================================
// Slide In Animations
// ============================================
// ============================================
// Scale In Animation
// ============================================
// ============================================
// Staggered List Animation
// ============================================

interface StaggeredListProps {
  children: ReactNode[];
  staggerDelay?: number;
  initialDelay?: number;
  animation?: 'fade-up' | 'slide-right' | 'slide-left' | 'scale';
  className?: string;
  itemClassName?: string;
}

function getStaggeredChildKey(child: ReactNode): string {
  if (isValidElement(child) && child.key !== null) {
    return String(child.key);
  }
  if (typeof child === 'string' || typeof child === 'number') {
    return String(child);
  }
  return 'staggered-child';
}

const staggerAnimations = {
  'fade-up': 'animate-fade-up',
  'slide-right': 'animate-slide-in-right',
  'slide-left': 'animate-slide-in-left',
  scale: 'animate-scale-in',
};

/**
 * Renders children with staggered entrance animations.
 * Perfect for lists, grids, and sequential content reveals.
 */
export function StaggeredList({
  children,
  staggerDelay = 50,
  initialDelay = 0,
  animation = 'fade-up',
  className,
  itemClassName,
}: StaggeredListProps): ReactNode {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={getStaggeredChildKey(child)}
          className={cn(staggerAnimations[animation], 'opacity-0', itemClassName)}
          style={{ animationDelay: `${String(initialDelay + index * staggerDelay)}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Value Change Animation
// ============================================
// ============================================
// Glow Pulse Animation
// ============================================
// ============================================
// Loading Skeleton
// ============================================
// ============================================
// Bounce In Animation
// ============================================
// ============================================
// Interactive Card Wrapper
// ============================================
