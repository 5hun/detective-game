import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

export default tseslint.config(
  { ignores: ['dist/**', '_site/**', 'node_modules/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.tests.json',
        // This project includes both browser scripts and tests, unlike tsconfig.json.
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
  },
  {
    files: ['engine.ts', 'i18n.ts'],
    rules: {
      // A classic script exposes this API to the browser and CommonJS tests.
      'no-var': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^Detective(Engine|I18n)$' }],
    },
  },
  {
    files: ['types.d.ts'],
    rules: {
      // Ambient var declarations describe properties assigned through window.
      'no-var': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests use CommonJS, including an optional Playwright installation path.
      '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true, allow: ['playwright', '../engine\\.js'] }],
    },
  },
);
