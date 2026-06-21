import { cn } from '@shared/lib/utils';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import type { ReactNode } from 'react';

interface StatCellProps {
  label: string;
  value: number;
  formatter: (value: number) => string;
  sublabel?: string | undefined;
  highlight?: boolean | undefined;
}

export function StatCell({
  label,
  value,
  formatter,
  sublabel,
  highlight = false,
}: StatCellProps): ReactNode {
  return (
    <div className="flex h-full flex-col justify-center p-4">
      <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </span>
      <span
        className={cn(
          'mt-1 font-mono text-2xl font-semibold',
          highlight ? 'text-primary' : 'text-foreground'
        )}
      >
        <AnimatedNumber value={value} formatter={formatter} duration={600} />
      </span>
      {sublabel !== undefined && (
        <span className="text-muted-foreground mt-1 text-xs">{sublabel}</span>
      )}
    </div>
  );
}
