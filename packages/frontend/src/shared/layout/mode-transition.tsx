'use client';

import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { type ReactNode, useEffect, useReducer, useRef } from 'react';

interface ModeTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component that provides smooth fade transitions when switching between modes.
 * Preserves content visibility while animating opacity changes.
 */
export function ModeTransition({ children, className }: ModeTransitionProps): ReactNode {
  const { mode } = useUIMode();
  const [isTransitioning, dispatchTransitioning] = useReducer(
    (_current: boolean, next: boolean) => next,
    false
  );
  const prevMode = useRef(mode);

  useEffect(() => {
    if (mode !== prevMode.current) {
      dispatchTransitioning(true);
      const timer = setTimeout(() => {
        dispatchTransitioning(false);
        prevMode.current = mode;
      }, 200);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [mode]);

  return (
    <div
      className={cn(
        'transition-opacity duration-200 ease-in-out',
        isTransitioning ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Simple mode-aware content renderer with fade transition
 */
interface ModeContentProps {
  simple: ReactNode;
  advanced: ReactNode;
  className?: string;
}

export function ModeContent({ simple, advanced, className }: ModeContentProps): ReactNode {
  const { isSimple } = useUIMode();
  const [state, dispatchTransition] = useReducer(
    (
      current: { displayMode: 'simple' | 'advanced'; isTransitioning: boolean },
      action: { type: 'start' } | { type: 'finish'; displayMode: 'simple' | 'advanced' }
    ) => {
      switch (action.type) {
        case 'start':
          return { ...current, isTransitioning: true };
        case 'finish':
          return { displayMode: action.displayMode, isTransitioning: false };
      }
    },
    { displayMode: isSimple ? 'simple' : 'advanced', isTransitioning: false }
  );
  const { displayMode, isTransitioning } = state;

  useEffect(() => {
    const newMode = isSimple ? 'simple' : 'advanced';
    if (newMode !== displayMode) {
      dispatchTransition({ type: 'start' });
      // Start fade out, then switch content, then fade in
      const timer = setTimeout(() => {
        dispatchTransition({ type: 'finish', displayMode: newMode });
      }, 150);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [isSimple, displayMode]);

  return (
    <div
      className={cn(
        'transition-opacity duration-150 ease-in-out',
        isTransitioning ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      {displayMode === 'simple' ? simple : advanced}
    </div>
  );
}
