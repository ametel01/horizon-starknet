import type { ReactNode } from 'react';

export function PreviewTooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      className="group relative cursor-help border-0 bg-transparent p-0 text-inherit"
      aria-label={content}
    >
      {children}
      <span
        className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        role="tooltip"
      >
        {content}
      </span>
    </button>
  );
}
