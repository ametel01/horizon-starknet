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
