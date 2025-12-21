// Virtual module: apibara/types
// Runtime configuration provided by Apibara CLI
declare module "apibara/types" {
  export interface ApibaraRuntimeConfig {
    /**
     * The preset name (e.g., "mainnet", "sepolia", "devnet")
     */
    preset?: string;

    /**
     * Starknet-specific configuration
     */
    starknet?: {
      /**
       * Stream URL for the DNA server
       */
      streamUrl?: string;
      /**
       * Starting block number
       */
      startingBlock?: number;
    };

    /**
     * EVM-specific configuration
     */
    evm?: {
      /**
       * Stream URL for the DNA server
       */
      streamUrl?: string;
      /**
       * Starting block number
       */
      startingBlock?: number;
    };
  }
}
