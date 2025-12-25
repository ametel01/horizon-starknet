import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    server: {
      deps: {
        inline: [
          "@apibara/plugin-drizzle",
          "@apibara/indexer",
          "@apibara/protocol",
          "@apibara/starknet",
          "apibara",
        ],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
