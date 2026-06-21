import type { ReactNode } from 'react';

export function EmptyState({ message }: { message: string }): ReactNode {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      {message}
    </div>
  );
}
