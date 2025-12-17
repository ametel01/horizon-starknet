import { cn } from '@/lib/utils';

// Version should match package.json
const PROTOCOL_VERSION = '0.4.0';

interface VersionBadgeProps {
  className?: string;
}

export function VersionBadge({ className }: VersionBadgeProps): React.ReactNode {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-muted-foreground text-xs">Protocol</span>
      <span className="border-border bg-muted text-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
        v{PROTOCOL_VERSION}
      </span>
    </div>
  );
}
