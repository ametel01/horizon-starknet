'use client';

import { createContext, use, useCallback, useEffect, useReducer } from 'react';

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

// Version localStorage keys to prevent data corruption on schema changes
// Increment version when changing the stored data structure
const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `horizon-ui-mode-${STORAGE_VERSION}`;
const ONBOARDING_KEY = `horizon-ui-onboarding-seen-${STORAGE_VERSION}`;

interface UIModeProviderProps {
  children: React.ReactNode;
  initialMode?: UIMode;
}

interface UIModeState {
  mode: UIMode;
  isHydrated: boolean;
  hasSeenOnboarding: boolean;
}

type UIModeAction =
  | { type: 'hydrate'; mode: UIMode; hasSeenOnboarding: boolean }
  | { type: 'set-mode'; mode: UIMode }
  | { type: 'dismiss-onboarding' };

function uiModeReducer(state: UIModeState, action: UIModeAction): UIModeState {
  switch (action.type) {
    case 'hydrate':
      return {
        mode: action.mode,
        isHydrated: true,
        hasSeenOnboarding: action.hasSeenOnboarding,
      };
    case 'set-mode':
      return { ...state, mode: action.mode };
    case 'dismiss-onboarding':
      return { ...state, hasSeenOnboarding: true };
  }
}

export function UIModeProvider({
  children,
  initialMode = 'simple',
}: UIModeProviderProps): React.ReactNode {
  const [state, dispatch] = useReducer(uiModeReducer, {
    mode: initialMode,
    isHydrated: false,
    hasSeenOnboarding: true,
  });
  const { mode, isHydrated, hasSeenOnboarding } = state;

  // Load from localStorage on mount
  useEffect(() => {
    let nextMode = initialMode;
    let nextHasSeenOnboarding = true;

    try {
      const storedMode = localStorage.getItem(STORAGE_KEY);
      if (storedMode === 'simple' || storedMode === 'advanced') {
        nextMode = storedMode;
      }

      const seenOnboarding = localStorage.getItem(ONBOARDING_KEY);
      nextHasSeenOnboarding = seenOnboarding === 'true';
    } catch {
      // localStorage unavailable (private browsing, disabled cookies, etc.), use defaults
    }

    dispatch({
      type: 'hydrate',
      mode: nextMode,
      hasSeenOnboarding: nextHasSeenOnboarding,
    });
  }, [initialMode]);

  // Persist mode to localStorage on change
  const setMode = useCallback((newMode: UIMode) => {
    dispatch({ type: 'set-mode', mode: newMode });
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage unavailable, mode still works in memory
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'simple' ? 'advanced' : 'simple');
    // Dismiss onboarding when user interacts with toggle
    if (!hasSeenOnboarding) {
      dispatch({ type: 'dismiss-onboarding' });
      try {
        localStorage.setItem(ONBOARDING_KEY, 'true');
      } catch {
        // localStorage unavailable
      }
    }
  }, [mode, setMode, hasSeenOnboarding]);

  // Dismiss onboarding tooltip
  const dismissOnboarding = useCallback(() => {
    dispatch({ type: 'dismiss-onboarding' });
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
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
  const context = use(UIModeContext);
  if (!context) {
    throw new Error('useUIMode must be used within a UIModeProvider');
  }
  return context;
}
