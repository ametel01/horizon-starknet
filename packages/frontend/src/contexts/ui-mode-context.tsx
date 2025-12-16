'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UIMode = 'simple' | 'advanced';

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isSimple: boolean;
  isAdvanced: boolean;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

const STORAGE_KEY = 'horizon-ui-mode';

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

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'simple' || stored === 'advanced') {
      setModeState(stored);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'simple' ? 'advanced' : 'simple');
  }, [mode, setMode]);

  const value: UIModeContextValue = {
    mode,
    setMode,
    toggleMode,
    isSimple: mode === 'simple',
    isAdvanced: mode === 'advanced',
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
