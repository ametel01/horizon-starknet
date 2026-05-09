'use client';

import { cn } from '@shared/lib/utils';
import { type HTMLAttributes, isValidElement, type ReactNode } from 'react';

/**
 * Animation Components for Horizon Protocol
 *
 * These components provide easy-to-use animation wrappers
 * with staggered entrance effects and value change animations.
 */

// ============================================
// Fade Up Animation
// ============================================

interface FadeUpProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Fade up entrance animation with optional stagger delay.
 * Uses animation-delay for staggered list entrances.
 */
export function FadeUp({
  children,
  delay = 0,
  className,
  style,
  ...props
}: FadeUpProps): ReactNode {
  return (
    <div
      className={cn('animate-fade-up opacity-0', className)}
      style={{ animationDelay: `${String(delay)}ms`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// Slide In Animations
// ============================================

type SlideDirection = 'left' | 'right' | 'bottom';

interface SlideInProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  direction?: SlideDirection;
  delay?: number;
  className?: string;
}

const slideAnimations: Record<SlideDirection, string> = {
  left: 'animate-slide-in-left',
  right: 'animate-slide-in-right',
  bottom: 'animate-slide-in-bottom',
};

/**
 * Slide in animation from specified direction.
 */
export function SlideIn({
  children,
  direction = 'right',
  delay = 0,
  className,
  style,
  ...props
}: SlideInProps): ReactNode {
  return (
    <div
      className={cn(slideAnimations[direction], 'opacity-0', className)}
      style={{ animationDelay: `${String(delay)}ms`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// Scale In Animation
// ============================================

interface ScaleInProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Scale in animation for modals, popups, and cards.
 */
export function ScaleIn({
  children,
  delay = 0,
  className,
  style,
  ...props
}: ScaleInProps): ReactNode {
  return (
    <div
      className={cn('animate-scale-in opacity-0', className)}
      style={{ animationDelay: `${String(delay)}ms`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

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

interface AnimatedValueProps {
  children: ReactNode;
  flash?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

const flashClasses = {
  positive: 'value-positive-flash',
  negative: 'value-negative-flash',
  neutral: 'value-changed',
};

/**
 * Animates value changes with color flash effects.
 * Use key prop to trigger animation on value change.
 */
export function AnimatedValue({
  children,
  flash = 'neutral',
  className,
}: AnimatedValueProps): ReactNode {
  return <span className={cn(flashClasses[flash], className)}>{children}</span>;
}

// ============================================
// Glow Pulse Animation
// ============================================

interface GlowPulseProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/**
 * Ambient glow pulse effect for highlighting important elements.
 */
export function GlowPulse({ children, className, ...props }: GlowPulseProps): ReactNode {
  return (
    <div className={cn('animate-glow-pulse', className)} {...props}>
      {children}
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

interface SkeletonPulseProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * Animated skeleton loading placeholder.
 */
export function SkeletonPulse({ className, width, height }: SkeletonPulseProps): ReactNode {
  return (
    <div
      className={cn('skeleton-pulse rounded', className)}
      style={{
        width: typeof width === 'number' ? `${String(width)}px` : width,
        height: typeof height === 'number' ? `${String(height)}px` : height,
      }}
    />
  );
}

// ============================================
// Bounce In Animation
// ============================================

interface BounceInProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Bounce in animation for attention-grabbing elements.
 */
export function BounceIn({
  children,
  delay = 0,
  className,
  style,
  ...props
}: BounceInProps): ReactNode {
  return (
    <div
      className={cn('animate-bounce-in opacity-0', className)}
      style={{ animationDelay: `${String(delay)}ms`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// Interactive Card Wrapper
// ============================================

interface InteractiveCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'glow-border';
  className?: string;
}

const hoverEffects = {
  lift: 'hover-lift',
  scale: 'hover-scale',
  glow: 'hover-glow',
  'glow-border': 'card-hover-glow',
};

/**
 * Interactive card wrapper with hover effects.
 */
export function InteractiveCard({
  children,
  hoverEffect = 'lift',
  className,
  ...props
}: InteractiveCardProps): ReactNode {
  return (
    <div className={cn(hoverEffects[hoverEffect], 'active-press', className)} {...props}>
      {children}
    </div>
  );
}
