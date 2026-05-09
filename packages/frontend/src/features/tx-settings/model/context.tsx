'use client';

import { createContext, use, useCallback, useEffect, useState } from 'react';

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

export interface TransactionSettings {
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

/** Default slippage: 50 basis points = 0.5% */
export const DEFAULT_SLIPPAGE_BPS = 50;

/** Default deadline: 20 minutes */
export const DEFAULT_DEADLINE_MINUTES = 20;

/**
 * Predefined slippage options with semantic labels.
 *
 * Implements Hick's Law: Reduced from 4 to 3 options with meaningful names.
 * Users can still set custom values for advanced needs.
 */
export const SLIPPAGE_OPTIONS = [
  { label: 'Low', percent: '0.1%', value: 10, description: 'May fail in volatile markets' },
  { label: 'Standard', percent: '0.5%', value: 50, description: 'Recommended for most trades' },
  { label: 'Fast', percent: '1%', value: 100, description: 'Higher chance of execution' },
] as const;

/** Predefined deadline options */
export const DEADLINE_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
] as const;

/** Validation limits */
export const MIN_SLIPPAGE_BPS = 1; // 0.01%
export const MAX_SLIPPAGE_BPS = 5000; // 50%
export const MIN_DEADLINE_MINUTES = 1;
export const MAX_DEADLINE_MINUTES = 60;

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
  const [slippageBps, setSlippageBpsState] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [deadlineMinutes, setDeadlineMinutesState] = useState<number>(DEFAULT_DEADLINE_MINUTES);

  // Load from localStorage on mount (client-side only)
  // Values start with defaults during SSR, then update to stored values
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<TransactionSettings>;
        if (typeof parsed.slippageBps === 'number') {
          setSlippageBpsState(
            Math.min(MAX_SLIPPAGE_BPS, Math.max(MIN_SLIPPAGE_BPS, parsed.slippageBps))
          );
        }
        if (typeof parsed.deadlineMinutes === 'number') {
          setDeadlineMinutesState(
            Math.min(MAX_DEADLINE_MINUTES, Math.max(MIN_DEADLINE_MINUTES, parsed.deadlineMinutes))
          );
        }
      }
    } catch {
      // localStorage unavailable or invalid JSON, use defaults
    }
  }, []);

  // Persist to localStorage helper
  const persistSettings = useCallback((slippage: number, deadline: number) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          slippageBps: slippage,
          deadlineMinutes: deadline,
        })
      );
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Setters with validation
  const setSlippageBps = useCallback(
    (bps: number) => {
      const validated = Math.min(MAX_SLIPPAGE_BPS, Math.max(MIN_SLIPPAGE_BPS, bps));
      setSlippageBpsState(validated);
      persistSettings(validated, deadlineMinutes);
    },
    [deadlineMinutes, persistSettings]
  );

  const setDeadlineMinutes = useCallback(
    (minutes: number) => {
      const validated = Math.min(MAX_DEADLINE_MINUTES, Math.max(MIN_DEADLINE_MINUTES, minutes));
      setDeadlineMinutesState(validated);
      persistSettings(slippageBps, validated);
    },
    [slippageBps, persistSettings]
  );

  const resetToDefaults = useCallback(() => {
    setSlippageBpsState(DEFAULT_SLIPPAGE_BPS);
    setDeadlineMinutesState(DEFAULT_DEADLINE_MINUTES);
    persistSettings(DEFAULT_SLIPPAGE_BPS, DEFAULT_DEADLINE_MINUTES);
  }, [persistSettings]);

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

/**
 * Get deadline as bigint timestamp for contract calls
 * Uses the deadline from settings context
 */
export function useDeadline(): bigint {
  const { deadlineSeconds } = useTransactionSettings();
  return BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
}

/**
 * Get slippage in WAD format for contract calculations
 * Returns slippage as a fraction (e.g., 0.005 * 10^18 for 0.5%)
 */
export function useSlippageWad(): bigint {
  const { slippageDecimal } = useTransactionSettings();
  return BigInt(Math.floor(slippageDecimal * 1e18));
}
