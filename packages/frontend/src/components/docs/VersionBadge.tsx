import { cn } from '@shared/lib/utils';

import packageJson from '../../../package.json';

interface VersionBadgeProps {
  className?: string;
}

export function VersionBadge({ className }: VersionBadgeProps): React.ReactNode {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-muted-foreground text-xs">Protocol</span>
      <span className="border-border bg-muted text-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
        v{packageJson.version}
      </span>
    </div>
  );
}
