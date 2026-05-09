'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

import { cn } from '@shared/lib/utils';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';

interface FormulaProps {
  children: string;
  display?: boolean;
  className?: string;
}

export function Formula({ children, display = false, className }: FormulaProps): ReactNode {
  const formulaRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  useEffect(() => {
    const node = formulaRef.current;
    if (!node) return;

    katex.render(children, node, {
      throwOnError: false,
      displayMode: display,
    });

    return () => {
      node.textContent = children;
    };
  }, [children, display]);

  if (display) {
    return (
      <div
        ref={formulaRef as RefObject<HTMLDivElement>}
        className={cn(
          'border-border bg-muted/30 my-6 overflow-x-auto rounded-lg border px-4 py-6 text-center',
          className
        )}
        aria-label={children}
        role="math"
      >
        {children}
      </div>
    );
  }

  return (
    <span
      ref={formulaRef as RefObject<HTMLSpanElement>}
      className={cn('mx-0.5', className)}
      aria-label={children}
      role="math"
    >
      {children}
    </span>
  );
}
