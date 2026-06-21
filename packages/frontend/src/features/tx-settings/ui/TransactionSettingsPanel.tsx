'use client';

/**
 * Decision table for confidence indicator display.
 * Maps confidence level to styling and symbol.
 */
type ConfidenceLevel = 'high' | 'medium' | 'low';

const _CONFIDENCE_DISPLAY: Record<ConfidenceLevel, { className: string; symbol: string }> = {
  high: { className: 'text-success', symbol: '●' },
  medium: { className: 'text-warning', symbol: '◐' },
  low: { className: 'text-muted-foreground', symbol: '○' },
};
