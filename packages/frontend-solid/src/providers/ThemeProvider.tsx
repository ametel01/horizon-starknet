import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type ParentProps,
  useContext,
} from 'solid-js';
import { isServer } from 'solid-js/web';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: Accessor<Theme>;
  resolvedTheme: Accessor<'light' | 'dark'>;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'horizon-theme';

export const ThemeContext = createContext<ThemeContextValue>();

function getSystemTheme(): 'light' | 'dark' {
  if (isServer) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  if (isServer) return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

function applyThemeClass(resolvedTheme: 'light' | 'dark'): void {
  if (isServer) return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
}

export function ThemeProvider(props: ParentProps): ReturnType<typeof ThemeContext.Provider> {
  // Initialize with 'system' default, actual value loaded on mount to avoid SSR mismatch
  const [theme, setThemeSignal] = createSignal<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = createSignal<'light' | 'dark'>('dark');

  // Load stored theme on mount (client-side only)
  onMount(() => {
    const stored = getStoredTheme();
    if (stored) {
      setThemeSignal(stored);
    }

    // Calculate initial resolved theme
    const currentTheme = stored ?? 'system';
    const resolved = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      if (theme() === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyThemeClass(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Cleanup listener on unmount
    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  });

  // Update resolved theme and apply class when theme changes
  createEffect(() => {
    const currentTheme = theme();
    if (isServer) return;

    const resolved = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  });

  const setTheme = (newTheme: Theme): void => {
    setThemeSignal(newTheme);

    // Persist to localStorage
    if (!isServer) {
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // localStorage not available
      }
    }
  };

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
