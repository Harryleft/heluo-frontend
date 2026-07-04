import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      'recovery/**',
      '.claude/**',
      'coverage/**',
      'node_modules/**',
      '.agents/**',
      '.codex/**',
      '.playwright-cli/**',
      'server/embedding-service/.venv/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        Event: 'readonly',
        JSX: 'readonly',
        FormData: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // 黄金原则：禁止相对路径导入（强制使用 @/ 绝对路径）
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../*'],
          message: '禁止使用相对路径导入。请使用 @/ 绝对路径，例如：import { foo } from "@/lib/utils/foo"。参考 CLAUDE.md 导入约定。',
        }],
      }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/lib/api/http'],
            message: 'features 层禁止直接 import lib/api/http，请使用 @/providers/apiClient',
          },
          {
            group: ['axios'],
            message: 'features 层禁止直接 import axios，请使用 @/providers/apiClient 中的 isAxiosError',
          },
        ],
      }],
    },
  },
]
