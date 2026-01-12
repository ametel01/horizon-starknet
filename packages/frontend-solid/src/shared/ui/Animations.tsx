import { cn } from '@shared/lib/utils';
import { type ComponentProps, For, type JSX, splitProps } from 'solid-js';

/**
 * Animation Components for Horizon Protocol (SolidJS)
 *
 * These components provide easy-to-use animation wrappers
 * with staggered entrance effects and value change animations.
 */

// ============================================
// Fade Up Animation
// ============================================

interface FadeUpProps extends ComponentProps<'div'> {
  children: JSX.Element;
  delay?: number;
  class?: string;
}

/**
 * Fade up entrance animation with optional stagger delay.
 * Uses animation-delay for staggered list entrances.
 */
function FadeUp(props: FadeUpProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'delay', 'class', 'style']);
  const delayMs = () => local.delay ?? 0;

  return (
    <div
      class={cn('animate-fade-up opacity-0', local.class)}
      style={{
        'animation-delay': `${delayMs()}ms`,
        ...(typeof local.style === 'object' ? local.style : {}),
      }}
      {...others}
    >
      {local.children}
    </div>
  );
}

// ============================================
// Slide In Animations
// ============================================

type SlideDirection = 'left' | 'right' | 'bottom';

interface SlideInProps extends ComponentProps<'div'> {
  children: JSX.Element;
  direction?: SlideDirection;
  delay?: number;
  class?: string;
}

const slideAnimations: Record<SlideDirection, string> = {
  left: 'animate-slide-in-left',
  right: 'animate-slide-in-right',
  bottom: 'animate-slide-in-bottom',
};

/**
 * Slide in animation from specified direction.
 */
function SlideIn(props: SlideInProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'direction', 'delay', 'class', 'style']);
  const direction = () => local.direction ?? 'right';
  const delayMs = () => local.delay ?? 0;

  return (
    <div
      class={cn(slideAnimations[direction()], 'opacity-0', local.class)}
      style={{
        'animation-delay': `${delayMs()}ms`,
        ...(typeof local.style === 'object' ? local.style : {}),
      }}
      {...others}
    >
      {local.children}
    </div>
  );
}

// ============================================
// Scale In Animation
// ============================================

interface ScaleInProps extends ComponentProps<'div'> {
  children: JSX.Element;
  delay?: number;
  class?: string;
}

/**
 * Scale in animation for modals, popups, and cards.
 */
function ScaleIn(props: ScaleInProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'delay', 'class', 'style']);
  const delayMs = () => local.delay ?? 0;

  return (
    <div
      class={cn('animate-scale-in opacity-0', local.class)}
      style={{
        'animation-delay': `${delayMs()}ms`,
        ...(typeof local.style === 'object' ? local.style : {}),
      }}
      {...others}
    >
      {local.children}
    </div>
  );
}

// ============================================
// Staggered List Animation
// ============================================

interface StaggeredListProps {
  children: JSX.Element[];
  staggerDelay?: number;
  initialDelay?: number;
  animation?: 'fade-up' | 'slide-right' | 'slide-left' | 'scale';
  class?: string;
  itemClass?: string;
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
function StaggeredList(props: StaggeredListProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'children',
    'staggerDelay',
    'initialDelay',
    'animation',
    'class',
    'itemClass',
  ]);

  const staggerDelay = () => local.staggerDelay ?? 50;
  const initialDelay = () => local.initialDelay ?? 0;
  const animation = () => local.animation ?? 'fade-up';

  return (
    <div class={local.class} {...others}>
      <For each={local.children}>
        {(child, index) => (
          <div
            class={cn(staggerAnimations[animation()], 'opacity-0', local.itemClass)}
            style={{ 'animation-delay': `${initialDelay() + index() * staggerDelay()}ms` }}
          >
            {child}
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================
// Value Change Animation
// ============================================

interface AnimatedValueProps {
  children: JSX.Element;
  flash?: 'positive' | 'negative' | 'neutral';
  class?: string;
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
function AnimatedValue(props: AnimatedValueProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'flash', 'class']);
  const flash = () => local.flash ?? 'neutral';

  return (
    <span class={cn(flashClasses[flash()], local.class)} {...others}>
      {local.children}
    </span>
  );
}

// ============================================
// Glow Pulse Animation
// ============================================

interface GlowPulseProps extends ComponentProps<'div'> {
  children: JSX.Element;
  class?: string;
}

/**
 * Ambient glow pulse effect for highlighting important elements.
 */
function GlowPulse(props: GlowPulseProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'class']);

  return (
    <div class={cn('animate-glow-pulse', local.class)} {...others}>
      {local.children}
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

interface SkeletonPulseProps {
  class?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * Animated skeleton loading placeholder.
 */
function SkeletonPulse(props: SkeletonPulseProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'width', 'height']);

  return (
    <div
      class={cn('skeleton-pulse rounded', local.class)}
      style={{
        width: typeof local.width === 'number' ? `${local.width}px` : local.width,
        height: typeof local.height === 'number' ? `${local.height}px` : local.height,
      }}
      {...others}
    />
  );
}

// ============================================
// Bounce In Animation
// ============================================

interface BounceInProps extends ComponentProps<'div'> {
  children: JSX.Element;
  delay?: number;
  class?: string;
}

/**
 * Bounce in animation for attention-grabbing elements.
 */
function BounceIn(props: BounceInProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'delay', 'class', 'style']);
  const delayMs = () => local.delay ?? 0;

  return (
    <div
      class={cn('animate-bounce-in opacity-0', local.class)}
      style={{
        'animation-delay': `${delayMs()}ms`,
        ...(typeof local.style === 'object' ? local.style : {}),
      }}
      {...others}
    >
      {local.children}
    </div>
  );
}

// ============================================
// Interactive Card Wrapper
// ============================================

interface InteractiveCardProps extends ComponentProps<'div'> {
  children: JSX.Element;
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'glow-border';
  class?: string;
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
function InteractiveCard(props: InteractiveCardProps): JSX.Element {
  const [local, others] = splitProps(props, ['children', 'hoverEffect', 'class']);
  const hoverEffect = () => local.hoverEffect ?? 'lift';

  return (
    <div class={cn(hoverEffects[hoverEffect()], 'active-press', local.class)} {...others}>
      {local.children}
    </div>
  );
}

export {
  FadeUp,
  SlideIn,
  ScaleIn,
  StaggeredList,
  AnimatedValue,
  GlowPulse,
  SkeletonPulse,
  BounceIn,
  InteractiveCard,
};

export type {
  FadeUpProps,
  SlideInProps,
  ScaleInProps,
  StaggeredListProps,
  AnimatedValueProps,
  GlowPulseProps,
  SkeletonPulseProps,
  BounceInProps,
  InteractiveCardProps,
  SlideDirection,
};
