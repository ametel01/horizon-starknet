'use client';

import { useEffect, useState } from 'react';

import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps): React.ReactNode {
  const { mode, toggleMode, hasSeenOnboarding, dismissOnboarding } = useUIMode();
  const [showTooltip, setShowTooltip] = useState(false);

  // Show tooltip after a short delay for first-time users
  useEffect(() => {
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
      }, 1000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [hasSeenOnboarding]);

  // Auto-hide tooltip after 10 seconds
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => {
        dismissOnboarding();
        setShowTooltip(false);
      }, 10000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [showTooltip, dismissOnboarding]);

  const handleToggle = (): void => {
    toggleMode();
    setShowTooltip(false);
  };

  const handleDismiss = (): void => {
    dismissOnboarding();
    setShowTooltip(false);
  };

  return (
    <div className={cn('relative flex items-center gap-1.5', className)}>
      {/* Onboarding Tooltip */}
      {showTooltip && (
        <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-50 mt-2 w-64 duration-200">
          <div className="bg-card border-border rounded-lg border p-3 shadow-lg">
            <div className="mb-2 flex items-start justify-between">
              <span className="text-foreground text-sm font-medium">Interface Mode</span>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 p-1"
                aria-label="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              <span className="text-primary font-medium">Simple</span> mode shows straightforward
              yield earning. <span className="text-primary font-medium">Advanced</span> unlocks full
              protocol features like trading and liquidity.
            </p>
            {/* Arrow */}
            <div className="bg-card border-border absolute -top-2 right-8 h-4 w-4 rotate-45 border-t border-l" />
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'relative flex h-8 items-center overflow-hidden rounded-full border p-0.5 transition-colors',
          'border-border bg-muted',
          showTooltip && 'ring-primary/50 ring-2'
        )}
        aria-label={`Switch to ${mode === 'simple' ? 'advanced' : 'simple'} mode`}
      >
        {/* Background pill that slides */}
        <span
          className={cn(
            'bg-primary absolute h-7 rounded-full transition-all duration-200 ease-in-out',
            mode === 'simple' ? 'left-0.5 w-[4rem]' : 'left-[4.125rem] w-[5.25rem]'
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
