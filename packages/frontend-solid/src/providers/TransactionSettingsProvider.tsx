import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  onMount,
  type ParentProps,
  useContext,
} from 'solid-js';
import { isServer } from 'solid-js/web';

/**
 * Transaction Settings Provider
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

export interface TransactionSettingsContextValue {
  // Reactive values
  slippageBps: Accessor<number>;
  deadlineMinutes: Accessor<number>;

  // Setters
  setSlippageBps: (bps: number) => void;
  setDeadlineMinutes: (minutes: number) => void;
  resetToDefaults: () => void;

  // Computed values
  /** Slippage as a decimal (e.g., 0.005 for 0.5%) */
  slippageDecimal: Accessor<number>;
  /** Slippage as a percentage string (e.g., "0.5%") */
  slippagePercent: Accessor<string>;
  /** Deadline in seconds */
  deadlineSeconds: Accessor<number>;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'horizon-tx-settings';

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
// Helpers
// ============================================================================

/**
 * Validate and clamp slippage value to valid range
 */
function validateSlippage(bps: number): number {
  return Math.min(MAX_SLIPPAGE_BPS, Math.max(MIN_SLIPPAGE_BPS, bps));
}

/**
 * Validate and clamp deadline value to valid range
 */
function validateDeadline(minutes: number): number {
  return Math.min(MAX_DEADLINE_MINUTES, Math.max(MIN_DEADLINE_MINUTES, minutes));
}

/**
 * Load settings from localStorage
 */
function loadStoredSettings(): Partial<TransactionSettings> | null {
  if (isServer) return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Partial<TransactionSettings>;
    }
  } catch {
    // localStorage unavailable or invalid JSON
  }
  return null;
}

/**
 * Save settings to localStorage
 */
function persistSettings(slippageBps: number, deadlineMinutes: number): void {
  if (isServer) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        slippageBps,
        deadlineMinutes,
      })
    );
  } catch {
    // localStorage unavailable
  }
}

/**
 * Format slippage percentage string
 */
export function formatSlippagePercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/**
 * Get semantic label for slippage value
 */
export function getSlippageLabel(bps: number): string {
  if (bps <= 10) return 'very low';
  if (bps <= 30) return 'low';
  if (bps <= 75) return 'standard';
  if (bps <= 150) return 'moderate';
  if (bps <= 300) return 'high';
  return 'very high';
}

// ============================================================================
// Context
// ============================================================================

export const TransactionSettingsContext = createContext<TransactionSettingsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function TransactionSettingsProvider(
  props: ParentProps
): ReturnType<typeof TransactionSettingsContext.Provider> {
  // Initialize with defaults, actual values loaded on mount to avoid SSR mismatch
  const [slippageBps, setSlippageBpsSignal] = createSignal<number>(DEFAULT_SLIPPAGE_BPS);
  const [deadlineMinutes, setDeadlineMinutesSignal] =
    createSignal<number>(DEFAULT_DEADLINE_MINUTES);

  // Computed values using createMemo for reactive computed values
  const slippageDecimal = createMemo(() => slippageBps() / 10000);
  const slippagePercent = createMemo(() => formatSlippagePercent(slippageBps()));
  const deadlineSeconds = createMemo(() => deadlineMinutes() * 60);

  // Load from localStorage on mount (client-side only)
  onMount(() => {
    const stored = loadStoredSettings();
    if (stored) {
      if (typeof stored.slippageBps === 'number') {
        setSlippageBpsSignal(validateSlippage(stored.slippageBps));
      }
      if (typeof stored.deadlineMinutes === 'number') {
        setDeadlineMinutesSignal(validateDeadline(stored.deadlineMinutes));
      }
    }
  });

  // Setters with validation and persistence
  const setSlippageBps = (bps: number): void => {
    const validated = validateSlippage(bps);
    setSlippageBpsSignal(validated);
    persistSettings(validated, deadlineMinutes());
  };

  const setDeadlineMinutes = (minutes: number): void => {
    const validated = validateDeadline(minutes);
    setDeadlineMinutesSignal(validated);
    persistSettings(slippageBps(), validated);
  };

  const resetToDefaults = (): void => {
    setSlippageBpsSignal(DEFAULT_SLIPPAGE_BPS);
    setDeadlineMinutesSignal(DEFAULT_DEADLINE_MINUTES);
    persistSettings(DEFAULT_SLIPPAGE_BPS, DEFAULT_DEADLINE_MINUTES);
  };

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

  return (
    <TransactionSettingsContext.Provider value={value}>
      {props.children}
    </TransactionSettingsContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useTransactionSettings(): TransactionSettingsContextValue {
  const context = useContext(TransactionSettingsContext);
  if (!context) {
    throw new Error('useTransactionSettings must be used within a TransactionSettingsProvider');
  }
  return context;
}

/**
 * Get a function that computes a fresh deadline timestamp for contract calls.
 * Returns a getter function that calculates the deadline at call time,
 * ensuring the timestamp is always current when submitting transactions.
 */
export function useDeadline(): () => bigint {
  const { deadlineSeconds } = useTransactionSettings();
  // Return a function that computes fresh deadline on each call
  // Do NOT use createMemo here as Date.now() is not reactive and would cause stale timestamps
  return () => BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds());
}

/**
 * Get slippage in WAD format for contract calculations
 * Returns slippage as a fraction (e.g., 0.005 * 10^18 for 0.5%)
 */
export function useSlippageWad(): Accessor<bigint> {
  const { slippageDecimal } = useTransactionSettings();
  return createMemo(() => BigInt(Math.floor(slippageDecimal() * 1e18)));
}
