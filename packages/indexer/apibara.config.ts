import { defineConfig } from "apibara/config";

export default defineConfig({
  indexersDir: "src/indexers",
  runtimeConfig: {
    network: "devnet",
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
        network: "mainnet",
        starknet: {
          startingBlock: 800_000, // Horizon mainnet deployment block
          streamUrl: process.env.DNA_STREAM_URL ?? "http://dna-starknet:7171",
        },
      },
    },
    sepolia: {
      runtimeConfig: {
        network: "sepolia",
        starknet: {
          startingBlock: 100_000,
          streamUrl: process.env.DNA_STREAM_URL ?? "http://dna-starknet:7171",
        },
      },
    },
    devnet: {
      runtimeConfig: {
        network: "devnet",
        starknet: {
          startingBlock: 0,
          streamUrl: "http://localhost:7171",
        },
      },
    },
  },
});
