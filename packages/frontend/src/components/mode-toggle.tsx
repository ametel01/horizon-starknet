'use client';

import { useUIMode } from '@/contexts/ui-mode-context';
import { cn } from '@/lib/utils';

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps): React.ReactNode {
  const { mode, toggleMode } = useUIMode();

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={toggleMode}
        className={cn(
          'relative flex h-8 items-center rounded-full border p-0.5 transition-colors',
          'border-border bg-muted'
        )}
        aria-label={`Switch to ${mode === 'simple' ? 'advanced' : 'simple'} mode`}
      >
        {/* Background pill that slides */}
        <span
          className={cn(
            'bg-primary absolute h-7 rounded-full transition-all duration-200 ease-in-out',
            mode === 'simple' ? 'left-0.5 w-[4.25rem]' : 'left-[4.5rem] w-[5.5rem]'
          )}
        />

        {/* Simple label */}
        <span
          className={cn(
            'relative z-10 px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'simple' ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          Simple
        </span>

        {/* Advanced label */}
        <span
          className={cn(
            'relative z-10 px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'advanced' ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          Advanced
        </span>
      </button>
    </div>
  );
}
