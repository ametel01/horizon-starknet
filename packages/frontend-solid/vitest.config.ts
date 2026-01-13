import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/types/generated/**",
        "src/entry-*.tsx",
      ],
    },
    deps: {
      optimizer: {
        web: {
          include: ["solid-js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@shared": "/src/shared",
      "@entities": "/src/entities",
      "@features": "/src/features",
      "@widgets": "/src/widgets",
    },
    conditions: ["development", "browser"],
  },
});
