import { defineConfig } from "apibara/config";

export default defineConfig({
  runtimeConfig: {
    starknet: {
      startingBlock: 0,
      // DNA stream server URL (gRPC endpoint)
      // Self-hosted: point to your DNA server
      streamUrl: process.env.DNA_STREAM_URL ?? "http://localhost:7171",
    },
  },
  presets: {
    mainnet: {
      runtimeConfig: {
        starknet: {
          startingBlock: 800_000, // Horizon mainnet deployment block
          streamUrl: process.env.DNA_STREAM_URL ?? "http://dna-starknet:7171",
        },
      },
    },
    sepolia: {
      runtimeConfig: {
        starknet: {
          startingBlock: 100_000,
          streamUrl: process.env.DNA_STREAM_URL ?? "http://dna-starknet:7171",
        },
      },
    },
    devnet: {
      runtimeConfig: {
        starknet: {
          startingBlock: 0,
          streamUrl: "http://localhost:7171",
        },
      },
    },
  },
});
