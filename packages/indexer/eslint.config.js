import eslintJs from "@eslint/js";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import n from "eslint-plugin-n";
import promisePlugin from "eslint-plugin-promise";
import securityPlugin from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslintJs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    plugins: {
      import: importPlugin,
      promise: promisePlugin,
      security: securityPlugin,
      sonarjs,
      unicorn,
      "unused-imports": unusedImports,
      n,
    },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true, project: "./tsconfig.json" },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": "error",

      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: false, ignoreIIFE: false },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",

      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      "@typescript-eslint/restrict-plus-operands": [
        "error",
        { allowAny: false, allowBoolean: false, allowNullish: false },
      ],
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",

      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",

      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",

      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-invalid-void-type": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-extraneous-class": "error",

      "import/no-duplicates": "error",
      "import/no-cycle": ["error", { ignoreExternal: true, maxDepth: 2 }],
      "import/no-self-import": "error",
      "import/no-useless-path-segments": ["error", { noUselessIndex: true }],
      "import/no-unresolved": "off",
      "import/newline-after-import": "error",

      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroups: [{ pattern: "src/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],

      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-coercion": "error",
      "no-throw-literal": "error",
      "no-return-await": "error",

      "no-console": ["error", { allow: ["warn", "error"] }],

      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/catch-or-return": [
        "error",
        { allowFinally: true, terminationMethod: ["process.exit", "throw"] },
      ],
      "promise/no-nesting": "warn",

      "n/no-missing-import": "off",
      "n/no-unpublished-import": "off",
      "n/no-process-exit": "error",
      "n/prefer-global/process": ["error", "always"],
      "n/prefer-global/buffer": ["error", "always"],

      ...securityPlugin.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,

      "unicorn/no-abusive-eslint-disable": "error",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/filename-case": [
        "error",
        { case: "kebabCase", ignore: ["apibara\\.config\\.ts"] },
      ],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*.json"],
              message:
                "Do not import JSON directly (except ABIs via src/lib/abi).",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/lib/abi/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../indexers/**", "src/indexers/**"],
              message: "ABI layer must not depend on indexers.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/**/*.ts"],
    ignores: ["src/lib/abi/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["src/lib/abi/*.json", "src/lib/abi/**/*.json"],
              message:
                "Import ABIs only from src/lib/abi/index.ts (barrel), not direct JSON.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/indexers/**/*.ts"],
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off", // Template literals with numbers are fine
      "@typescript-eslint/no-non-null-assertion": "off", // Event data access often needs assertions
      "@typescript-eslint/require-await": "off", // Factory functions may not need await
      "@typescript-eslint/no-unnecessary-condition": "off", // Optional chaining is defensive
      "@typescript-eslint/explicit-function-return-type": "off", // Complex return types from Apibara
      "sonarjs/cognitive-complexity": "off", // Transform functions are inherently complex
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message:
                "Indexers must use src/lib/database.ts as the DB boundary.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../indexers/**", "src/indexers/**"],
              message: "lib must not import indexers (dependency direction).",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message: "Only src/lib/database.ts may import drizzle-orm.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/lib/database.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  {
    files: ["src/lib/utils.ts"],
    rules: {
      // Array indexing is safe - data comes from parsed blockchain events
      "security/detect-object-injection": "off",
    },
  },

  {
    files: ["src/schema/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../indexers/**", "src/indexers/**"],
              message: "schema must not import indexers.",
            },
            {
              group: ["../lib/database*", "src/lib/database*"],
              message:
                "schema must not import database.ts; keep schema pure.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/types/**/*.d.ts"],
    rules: {
      // Allow type augmentation imports in .d.ts files
      "no-restricted-imports": "off",
    },
  },

  {
    files: ["apibara.config.ts", "scripts/**/*.ts"],
    rules: {
      "n/no-process-exit": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "off", // Scripts can have top-level promise calls
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-require-imports": "off", // Scripts may need dynamic requires
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/slow-regex": "off",
      "promise/catch-or-return": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      // Security rules - scripts work with local files, not user input
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-require": "off",
      "security/detect-object-injection": "off",
    },
  },

  {
    files: [
      "tests/**/*.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "vitest.config.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },

  {
    files: [
      "*.config.{js,mjs,ts}",
      "*.config.*.{js,mjs,ts}",
      "eslint.config.{js,mjs,ts}",
      "drizzle.config.ts",
      "vitest.config.ts",
    ],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      ".turbo/",
      ".cache/",
      "drizzle/",
      ".apibara/",
      "**/*.generated.*",
    ],
  },
);
