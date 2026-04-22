'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that returns true after a specified delay.
 * Useful for staggered mount animations to prevent layout shift.
 *
 * @param delay - Delay in milliseconds before returning true (default: 50ms)
 * @returns boolean - false initially, true after delay
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const mounted = useDelayedMount(100);
 *   return (
 *     <div className={mounted ? 'opacity-100' : 'opacity-0'}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useDelayedMount(delay = 50): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay]);

  return mounted;
}
