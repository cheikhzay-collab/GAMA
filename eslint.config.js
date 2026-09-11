import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist/**',
    'scratch/**',
    'scripts/**',
    'data/**',
    'start-companion.js',
    'generate-icons-sharp.js',
    'dev-dist/**'
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_', 
        caughtErrorsIgnorePattern: '^_' 
      }],
      'no-useless-escape': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'no-control-regex': 'off',
      'no-useless-assignment': 'warn',
      'no-misleading-character-class': 'warn'
    },
  },
])
