import { defineConfig } from "@solidjs/start/config";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);

export default defineConfig({
  ssr: false, // Disable SSR to avoid hydration mismatches during development
  server: {
    preset: "bun",
  },
  vite: {
    resolve: {
      alias: {
        "@": resolve(root, "src"),
        "@shared": resolve(root, "src/shared"),
        "@entities": resolve(root, "src/entities"),
        "@features": resolve(root, "src/features"),
        "@widgets": resolve(root, "src/widgets"),
        "@contracts": resolve(root, "../../contracts/target/dev"),
        "@deploy": resolve(root, "../../deploy"),
        "@indexer": resolve(root, "../indexer/src"),
      },
    },
  },
});
