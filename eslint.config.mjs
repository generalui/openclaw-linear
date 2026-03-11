// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['dist/*', 'coverage/*', 'node_modules/*'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    files: ['**/*.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    rules: {
      complexity: 'error',
      'default-case-last': 'error',
      'default-param-last': 'off',
      'dot-notation': 'off',
      eqeqeq: 'error',
      'guard-for-in': 'error',
      'max-depth': 'error',
      'no-await-in-loop': 'error',
      'no-duplicate-imports': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-unused-vars': 'off',
      'no-use-before-define': 'off',
      'no-useless-rename': 'error',
      'no-sequences': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'require-atomic-updates': 'error',
      'require-await': 'off',
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, typedefs: false }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['*.config.{js,mjs,ts}', 'vitest.*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
)
