'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UIMode = 'simple' | 'advanced';

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isSimple: boolean;
  isAdvanced: boolean;
  // Onboarding
  hasSeenOnboarding: boolean;
  dismissOnboarding: () => void;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

const STORAGE_KEY = 'horizon-ui-mode';
const ONBOARDING_KEY = 'horizon-ui-onboarding-seen';

interface UIModeProviderProps {
  children: React.ReactNode;
  defaultMode?: UIMode;
}

export function UIModeProvider({
  children,
  defaultMode = 'simple',
}: UIModeProviderProps): React.ReactNode {
  const [mode, setModeState] = useState<UIMode>(defaultMode);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true); // Default to true to prevent flash

  // Load from localStorage on mount
  useEffect(() => {
    const storedMode = localStorage.getItem(STORAGE_KEY);
    if (storedMode === 'simple' || storedMode === 'advanced') {
      setModeState(storedMode);
    }

    const seenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    setHasSeenOnboarding(seenOnboarding === 'true');

    setIsHydrated(true);
  }, []);

  // Persist mode to localStorage on change
  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'simple' ? 'advanced' : 'simple');
    // Dismiss onboarding when user interacts with toggle
    if (!hasSeenOnboarding) {
      setHasSeenOnboarding(true);
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
  }, [mode, setMode, hasSeenOnboarding]);

  // Dismiss onboarding tooltip
  const dismissOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  const value: UIModeContextValue = {
    mode,
    setMode,
    toggleMode,
    isSimple: mode === 'simple',
    isAdvanced: mode === 'advanced',
    hasSeenOnboarding,
    dismissOnboarding,
  };

  // Prevent hydration mismatch by not rendering until we've loaded from localStorage
  if (!isHydrated) {
    return null;
  }

  return <UIModeContext.Provider value={value}>{children}</UIModeContext.Provider>;
}

export function useUIMode(): UIModeContextValue {
  const context = useContext(UIModeContext);
  if (!context) {
    throw new Error('useUIMode must be used within a UIModeProvider');
  }
  return context;
}
