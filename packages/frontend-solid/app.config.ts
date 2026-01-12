import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    preset: "bun",
  },
  vite: {
    resolve: {
      alias: {
        "@": "/src",
        "@shared": "/src/shared",
        "@entities": "/src/entities",
        "@features": "/src/features",
        "@widgets": "/src/widgets",
        "@contracts": "../../contracts/target/dev",
        "@deploy": "../../deploy",
        "@indexer": "../indexer/src",
      },
    },
  },
});
