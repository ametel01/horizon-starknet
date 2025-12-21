// Virtual module: apibara/plugins
// Plugin utilities provided by Apibara CLI runtime
declare module "apibara/plugins" {
  import type { ConsolaInstance } from "consola";

  /**
   * Returns a logger instance for the current indexer context
   */
  export function useLogger(): ConsolaInstance;
}
