/**
 * Shared Apibara indexer plugins
 */

import type { Indexer } from "apibara/indexer";

/**
 * Stream timeout plugin
 *
 * Increases the DNA stream timeout to handle Starknet's variable block times.
 * Default Apibara timeout is 45 seconds, which is too aggressive when blocks
 * take longer to produce during low activity periods.
 *
 * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
 */
export function streamTimeoutPlugin<TFilter, TBlock>(timeoutMs = 300_000) {
  return (indexer: Indexer<TFilter, TBlock>) => {
    indexer.hooks.hook("connect:before", ({ options }) => {
      options.timeout = timeoutMs;
    });
  };
}
