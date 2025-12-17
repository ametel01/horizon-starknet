'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

import { cn } from '@/lib/utils';

interface FormulaProps {
  children: string;
  display?: boolean;
  className?: string;
}

export function Formula({ children, display = false, className }: FormulaProps): React.ReactNode {
  const html = katex.renderToString(children, {
    throwOnError: false,
    displayMode: display,
  });

  if (display) {
    return (
      <div
        className={cn(
          'my-6 overflow-x-auto rounded-lg border border-border bg-muted/30 px-4 py-6 text-center',
          className
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className={cn('mx-0.5', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
