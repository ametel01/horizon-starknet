'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useUIMode } from '@/contexts/ui-mode-context';
import { cn } from '@/lib/utils';

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevMode, setPrevMode] = useState(mode);

  useEffect(() => {
    if (mode !== prevMode) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPrevMode(mode);
      }, 200);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [mode, prevMode]);

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
  const [displayMode, setDisplayMode] = useState<'simple' | 'advanced'>(
    isSimple ? 'simple' : 'advanced'
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const newMode = isSimple ? 'simple' : 'advanced';
    if (newMode !== displayMode) {
      setIsTransitioning(true);
      // Start fade out, then switch content, then fade in
      const timer = setTimeout(() => {
        setDisplayMode(newMode);
        setIsTransitioning(false);
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
