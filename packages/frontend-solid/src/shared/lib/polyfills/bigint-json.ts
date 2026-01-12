/**
 * BigInt JSON Serialization Polyfill
 *
 * This file patches JSON.stringify to handle BigInt values, which are not
 * natively serializable in JavaScript. This is needed because:
 * 1. starknet.js returns BigInt values from contract calls
 * 2. TanStack Query internally uses JSON.stringify for structural sharing
 *
 * IMPORTANT: This file must be imported before any TanStack Query code loads.
 */

// Only run in browser environment
if (typeof window !== 'undefined') {
  const originalStringify = JSON.stringify;

  // Custom replacer that converts BigInt to a serializable format
  function bigintReplacer(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
      return { __type: 'bigint', value: value.toString() };
    }
    return value;
  }

  // Patch JSON.stringify to handle BigInt
  // biome-ignore lint/suspicious/noExplicitAny: Required for patching global JSON.stringify
  (JSON.stringify as any) = (
    value: unknown,
    replacer?: Parameters<typeof originalStringify>[1],
    space?: Parameters<typeof originalStringify>[2]
  ): string => {
    try {
      return originalStringify(value, replacer, space);
    } catch (error) {
      if (error instanceof TypeError && String(error).includes('BigInt')) {
        // If the error is about BigInt, use our custom replacer
        // Combine with any existing replacer if provided
        if (typeof replacer === 'function') {
          const combinedReplacer = (key: string, val: unknown): unknown => {
            const replaced = (replacer as (key: string, value: unknown) => unknown)(key, val);
            return bigintReplacer(key, replaced);
          };
          return originalStringify(value, combinedReplacer, space);
        }
        return originalStringify(value, bigintReplacer, space);
      }
      throw error;
    }
  };
}

export {};
