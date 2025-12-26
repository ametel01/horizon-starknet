import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import nextPlugin from '@next/eslint-plugin-next';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      '@next/next': nextPlugin,
      'unused-imports': unusedImports,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
      },
    },
    rules: {
      // -------------------------
      // Next.js / React (App Router)
      // -------------------------
      ...nextPlugin.configs['core-web-vitals'].rules,

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-unescaped-entities': 'error',

      // -------------------------
      // TypeScript correctness
      // -------------------------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNullableBoolean: true, allowNullableString: true },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // -------------------------
      // Imports: hygiene + stability
      // -------------------------
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
            { pattern: '@entities/**', group: 'internal' },
            { pattern: '@features/**', group: 'internal' },
            { pattern: '@widgets/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import/no-unresolved': 'off',

      // -------------------------
      // General correctness
      // -------------------------
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // -------------------------
      // Security / architectural controls
      // -------------------------
      // NOTE: Architectural import restrictions are relaxed during migration
      // They will be re-enabled after Phase 6 (cleanup) is complete
      'no-restricted-imports': [
        'error',
        {
          // patterns: [
          //   // Avoid reaching into module internals; enforce public surfaces
          //   {
          //     group: ['@shared/**/**', '@entities/**/**', '@features/**/**', '@widgets/**/**'],
          //     message: 'Import via module public API (index.ts) when crossing module boundaries.',
          //   },
          //
          //   // Prevent legacy dumping-ground namespaces once you start migrating
          //   {
          //     group: ['@/components/**', '@/hooks/**', '@/contexts/**'],
          //     message: 'Do not grow global namespaces; move into shared/entities/features/widgets.',
          //   },
          // ],
          paths: [
            {
              name: 'next/script',
              message:
                'Use SecureScript wrapper (enforces SRI). Only import next/script directly when you need a special case with nonce.',
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------
  // Server-only code: allow Node deps and server patterns
  // ------------------------------------------------------------------
  {
    files: [
      'src/app/api/**/*.ts',
      'src/app/**/route.ts',
      'src/shared/server/**/*.ts',
      // Legacy paths (kept during migration)
      'src/lib/db/**/*.ts',
      'src/lib/rate-limit*.ts',
      'src/lib/validations/**/*.ts',
      'src/lib/logger.ts',
      'src/lib/cache.ts',
    ],
    rules: {
      'no-console': 'off',
      // Server files CAN use drizzle-orm and postgres
      'no-restricted-imports': 'off',
    },
  },

  // ------------------------------------------------------------------
  // Client components: forbid server-only imports (hard safety)
  // ------------------------------------------------------------------
  {
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    ignores: [
      'src/app/api/**/*.ts',
      'src/app/**/route.ts',
      'src/shared/server/**/*.ts',
      // Error boundaries and pages can use logger (logError works in both client/server)
      'src/app/**/error.tsx',
      'src/app/global-error.tsx',
      'src/app/**/page.tsx',
      'src/components/ErrorBoundary.tsx',
      // Legacy paths (kept during migration)
      'src/lib/db/**/*.ts',
      'src/lib/rate-limit*.ts',
      'src/lib/validations/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Anything DB / server-only must never be imported into UI/client bundles
            // NOTE: @shared/server/logger is allowed (logError works client-side too)
            {
              group: ['postgres', 'drizzle-orm', 'drizzle-orm/*', 'src/lib/db/**', '@/lib/db/**', '@shared/server/db/**', '@shared/server/rate-limit*', '@shared/server/validations/**'],
              message: 'Server-only module (db) cannot be imported into client/UI code.',
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------
  // Tests: relax a few rules
  // ------------------------------------------------------------------
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**/*.ts', 'src/test/**/*.tsx'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // ------------------------------------------------------------------
  // Config files: disable type-aware rules
  // ------------------------------------------------------------------
  {
    files: ['*.config.{js,mjs,ts}', '*.config.*.{js,mjs,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Allow next/script import in SecureScript wrapper
  {
    files: ['src/components/security/SecureScript.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    ignores: ['node_modules/', '.next/', 'dist/', 'coverage/', '*.config.js'],
  }
);
