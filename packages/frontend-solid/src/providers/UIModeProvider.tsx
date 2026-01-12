import {
  createContext,
  createMemo,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js';
import { isServer } from 'solid-js/web';

export type UIMode = 'simple' | 'advanced';

export interface UIModeContextValue {
  mode: Accessor<UIMode>;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isSimple: Accessor<boolean>;
  isAdvanced: Accessor<boolean>;
  // Onboarding
  hasSeenOnboarding: Accessor<boolean>;
  dismissOnboarding: () => void;
}

const STORAGE_KEY = 'horizon-ui-mode';
const ONBOARDING_KEY = 'horizon-ui-onboarding-seen';

export const UIModeContext = createContext<UIModeContextValue>();

function getStoredMode(): UIMode | null {
  if (isServer) return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'simple' || stored === 'advanced') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

function getStoredOnboarding(): boolean {
  if (isServer) return true; // Default to true to prevent flash
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    // localStorage not available
  }
  return true;
}

export interface UIModeProviderProps extends ParentProps {
  defaultMode?: UIMode;
}

export function UIModeProvider(props: UIModeProviderProps): ReturnType<typeof UIModeContext.Provider> {
  const defaultMode = props.defaultMode ?? 'simple';

  // Initialize with default, actual value loaded on mount to avoid SSR mismatch
  const [mode, setModeSignal] = createSignal<UIMode>(defaultMode);
  const [hasSeenOnboarding, setHasSeenOnboarding] = createSignal<boolean>(true);

  // Derived states using createMemo for reactive computed values
  const isSimple = createMemo(() => mode() === 'simple');
  const isAdvanced = createMemo(() => mode() === 'advanced');

  // Load stored values on mount (client-side only)
  onMount(() => {
    const storedMode = getStoredMode();
    if (storedMode) {
      setModeSignal(storedMode);
    }

    const seenOnboarding = getStoredOnboarding();
    setHasSeenOnboarding(seenOnboarding);
  });

  const setMode = (newMode: UIMode): void => {
    setModeSignal(newMode);

    // Persist to localStorage
    if (!isServer) {
      try {
        localStorage.setItem(STORAGE_KEY, newMode);
      } catch {
        // localStorage not available
      }
    }
  };

  const toggleMode = (): void => {
    const newMode = mode() === 'simple' ? 'advanced' : 'simple';
    setMode(newMode);

    // Dismiss onboarding when user interacts with toggle
    if (!hasSeenOnboarding()) {
      dismissOnboarding();
    }
  };

  const dismissOnboarding = (): void => {
    setHasSeenOnboarding(true);

    if (!isServer) {
      try {
        localStorage.setItem(ONBOARDING_KEY, 'true');
      } catch {
        // localStorage not available
      }
    }
  };

  const value: UIModeContextValue = {
    mode,
    setMode,
    toggleMode,
    isSimple,
    isAdvanced,
    hasSeenOnboarding,
    dismissOnboarding,
  };

  return <UIModeContext.Provider value={value}>{props.children}</UIModeContext.Provider>;
}

export function useUIMode(): UIModeContextValue {
  const context = useContext(UIModeContext);
  if (!context) {
    throw new Error('useUIMode must be used within a UIModeProvider');
  }
  return context;
}
