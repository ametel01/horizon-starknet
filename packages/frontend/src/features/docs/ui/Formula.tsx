'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';
import { createElement, useEffect, useRef } from 'react';

interface FormulaProps {
  children: string;
  display?: boolean;
  className?: string;
}

export function Formula({ children, display = false, className }: FormulaProps): ReactNode {
  const formulaRef = useRef<HTMLElement>(null);

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
    return createElement(
      'math',
      {
        ref: formulaRef,
        className: cn(
          'border-border bg-muted/30 my-6 block overflow-x-auto rounded-lg border px-4 py-6 text-center',
          className
        ),
        'aria-label': children,
      },
      children
    );
  }

  return createElement(
    'math',
    {
      ref: formulaRef,
      className: cn('mx-0.5 inline-block', className),
      'aria-label': children,
    },
    children
  );
}
