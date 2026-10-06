import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'build/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
  },
]);
