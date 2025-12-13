import { type ReactNode } from 'react';

interface VisuallyHiddenProps {
  children: ReactNode;
}

/**
 * Visually hide content while keeping it accessible to screen readers.
 * Useful for providing context that is visually obvious but needs to be
 * announced for assistive technology users.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps): ReactNode {
  return (
    <span
      className="absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
      style={{ clip: 'rect(0, 0, 0, 0)' }}
    >
      {children}
    </span>
  );
}
