'use client';

import { createContext, use, useCallback, useSyncExternalStore } from 'react';

import {
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_SLIPPAGE_BPS,
  MAX_DEADLINE_MINUTES,
  MAX_SLIPPAGE_BPS,
  MIN_DEADLINE_MINUTES,
  MIN_SLIPPAGE_BPS,
} from './settings';

/**
 * Transaction Settings Context
 *
 * Provides global transaction settings for slippage and deadline.
 * Settings persist to localStorage.
 *
 * @see Security Audit M-06 - Router Deadline Protection
 */

// ============================================================================
// Types
// ============================================================================

interface TransactionSettings {
  /** Slippage tolerance in basis points (100 = 1%). Default: 50 (0.5%) */
  slippageBps: number;
  /** Transaction deadline in minutes. Default: 20 */
  deadlineMinutes: number;
}

interface TransactionSettingsContextValue extends TransactionSettings {
  // Setters
  setSlippageBps: (bps: number) => void;
  setDeadlineMinutes: (minutes: number) => void;
  resetToDefaults: () => void;

  // Computed values
  /** Slippage as a decimal (e.g., 0.005 for 0.5%) */
  slippageDecimal: number;
  /** Slippage as a percentage string (e.g., "0.5%") */
  slippagePercent: string;
  /** Deadline in seconds */
  deadlineSeconds: number;
}

// ============================================================================
// Constants
// ============================================================================

// Version localStorage keys to prevent data corruption on schema changes
// Increment version when changing the stored data structure
const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `horizon-tx-settings-${STORAGE_VERSION}`;
const DEFAULT_TRANSACTION_SETTINGS: TransactionSettings = {
  slippageBps: DEFAULT_SLIPPAGE_BPS,
  deadlineMinutes: DEFAULT_DEADLINE_MINUTES,
};

let transactionSettingsSnapshot = DEFAULT_TRANSACTION_SETTINGS;
let memoryTransactionSettings = DEFAULT_TRANSACTION_SETTINGS;
let storageAvailable = true;
const transactionSettingsSubscribers = new Set<() => void>();

function clampSetting(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function clampTransactionSettings(settings: Partial<TransactionSettings>): TransactionSettings {
  return {
    slippageBps: clampSetting(
      settings.slippageBps,
      DEFAULT_SLIPPAGE_BPS,
      MIN_SLIPPAGE_BPS,
      MAX_SLIPPAGE_BPS
    ),
    deadlineMinutes: clampSetting(
      settings.deadlineMinutes,
      DEFAULT_DEADLINE_MINUTES,
      MIN_DEADLINE_MINUTES,
      MAX_DEADLINE_MINUTES
    ),
  };
}

function areTransactionSettingsEqual(
  left: TransactionSettings,
  right: TransactionSettings
): boolean {
  return left.slippageBps === right.slippageBps && left.deadlineMinutes === right.deadlineMinutes;
}

function readTransactionSettingsFromStorage(): TransactionSettings {
  if (typeof window === 'undefined' || !storageAvailable) {
    return memoryTransactionSettings;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return memoryTransactionSettings;
    }

    memoryTransactionSettings = clampTransactionSettings(
      JSON.parse(stored) as Partial<TransactionSettings>
    );
    return memoryTransactionSettings;
  } catch {
    storageAvailable = false;
    return memoryTransactionSettings;
  }
}

function getTransactionSettingsSnapshot(): TransactionSettings {
  const nextSnapshot = readTransactionSettingsFromStorage();
  if (areTransactionSettingsEqual(transactionSettingsSnapshot, nextSnapshot)) {
    return transactionSettingsSnapshot;
  }

  transactionSettingsSnapshot = nextSnapshot;
  return transactionSettingsSnapshot;
}

function getTransactionSettingsServerSnapshot(): TransactionSettings {
  return DEFAULT_TRANSACTION_SETTINGS;
}

function notifyTransactionSettingsSubscribers(): void {
  for (const subscriber of transactionSettingsSubscribers) {
    subscriber();
  }
}

function writeTransactionSettings(settings: TransactionSettings): void {
  memoryTransactionSettings = settings;
  transactionSettingsSnapshot = settings;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }

  notifyTransactionSettingsSubscribers();
}

function updateTransactionSettings(settings: Partial<TransactionSettings>): void {
  writeTransactionSettings(
    clampTransactionSettings({
      ...getTransactionSettingsSnapshot(),
      ...settings,
    })
  );
}

function subscribeTransactionSettings(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      storageAvailable = true;
      transactionSettingsSnapshot = readTransactionSettingsFromStorage();
      callback();
    }
  };

  transactionSettingsSubscribers.add(callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    transactionSettingsSubscribers.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

// ============================================================================
// Context
// ============================================================================

const TransactionSettingsContext = createContext<TransactionSettingsContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface TransactionSettingsProviderProps {
  children: React.ReactNode;
}

export function TransactionSettingsProvider({
  children,
}: TransactionSettingsProviderProps): React.ReactNode {
  const { slippageBps, deadlineMinutes } = useSyncExternalStore(
    subscribeTransactionSettings,
    getTransactionSettingsSnapshot,
    getTransactionSettingsServerSnapshot
  );

  // Setters with validation
  const setSlippageBps = useCallback((bps: number) => {
    updateTransactionSettings({ slippageBps: bps });
  }, []);

  const setDeadlineMinutes = useCallback((minutes: number) => {
    updateTransactionSettings({ deadlineMinutes: minutes });
  }, []);

  const resetToDefaults = useCallback(() => {
    writeTransactionSettings(DEFAULT_TRANSACTION_SETTINGS);
  }, []);

  // Computed values
  const slippageDecimal = slippageBps / 10000;
  const slippagePercent = `${(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 0 : 1)}%`;
  const deadlineSeconds = deadlineMinutes * 60;

  const value: TransactionSettingsContextValue = {
    slippageBps,
    deadlineMinutes,
    setSlippageBps,
    setDeadlineMinutes,
    resetToDefaults,
    slippageDecimal,
    slippagePercent,
    deadlineSeconds,
  };

  // Render with default values during SSR and hydration to prevent layout shift
  // Values will update to localStorage values after hydration completes
  // This follows Vercel's rendering-hydration-no-flicker guideline
  return (
    <TransactionSettingsContext.Provider value={value}>
      {children}
    </TransactionSettingsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTransactionSettings(): TransactionSettingsContextValue {
  const context = use(TransactionSettingsContext);
  if (!context) {
    throw new Error('useTransactionSettings must be used within a TransactionSettingsProvider');
  }
  return context;
}
