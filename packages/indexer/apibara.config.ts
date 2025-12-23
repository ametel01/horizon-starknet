import { defineConfig } from "apibara/config";

export default defineConfig({
  indexersDir: "src/indexers",
  runtimeConfig: {
    network: "devnet",
    starknet: {
      startingBlock: 0,
      // For devnet: use self-hosted DNA server
      streamUrl: process.env.DNA_STREAM_URL ?? "http://localhost:7171",
    },
  },
  presets: {
    mainnet: {
      runtimeConfig: {
        network: "mainnet",
        starknet: {
          startingBlock: 4_643_300, // Horizon mainnet deployment block (2025-12-23)
          // Apibara hosted DNA stream (requires DNA_TOKEN)
          // Can override with DNA_STREAM_URL env var for self-hosted DNA
          streamUrl: process.env.DNA_STREAM_URL ?? "https://mainnet.starknet.a5a.ch",
        },
      },
    },
    sepolia: {
      runtimeConfig: {
        network: "sepolia",
        starknet: {
          startingBlock: 4_194_445,
          // Apibara hosted DNA stream (requires DNA_TOKEN)
          streamUrl: "https://sepolia.starknet.a5a.ch",
        },
      },
    },
    devnet: {
      runtimeConfig: {
        network: "devnet",
        starknet: {
          startingBlock: 0,
          // Self-hosted DNA for local devnet
          streamUrl: process.env.DNA_STREAM_URL ?? "http://localhost:7171",
        },
      },
    },
  },
});
