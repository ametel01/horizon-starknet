'use client';

import { useEffect } from 'react';

/**
 * Auto-reset hook for transaction success states.
 * Replaces the repetitive useEffect pattern that resets state after a delay.
 *
 * Pattern replaced:
 * ```ts
 * useEffect(() => {
 *   if (isSuccess) {
 *     const timer = setTimeout(() => { reset(); }, 5000);
 *     return () => { clearTimeout(timer); };
 *   }
 *   return undefined;
 * }, [isSuccess, reset]);
 * ```
 */
export function useAutoReset(isSuccess: boolean, reset: () => void, delayMs: number = 5000): void {
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        reset();
      }, delayMs);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [isSuccess, reset, delayMs]);
}
