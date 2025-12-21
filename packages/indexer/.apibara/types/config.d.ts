// Virtual module: apibara/config
// Configuration utilities provided by Apibara CLI
declare module "apibara/config" {
  export interface RuntimeConfig {
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

  export interface PresetConfig {
    /**
     * Runtime configuration for this preset
     */
    runtimeConfig?: RuntimeConfig;
  }

  export interface ApibaraConfig {
    /**
     * Runtime configuration
     */
    runtimeConfig?: RuntimeConfig;

    /**
     * Presets for different networks
     */
    presets?: Record<string, PresetConfig>;
  }

  export function defineConfig(config: ApibaraConfig): ApibaraConfig;
}
