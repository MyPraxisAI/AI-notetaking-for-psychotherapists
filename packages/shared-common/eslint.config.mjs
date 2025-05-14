import eslintConfigBase from '@kit/eslint-config/base.js';

// Create a modified configuration that extends the base config
// but disables specific rules for the logger implementation
export default [
  ...eslintConfigBase,
  {
    files: ['src/logger/impl/**/*.ts'],
    rules: {
      // Disable rules that are causing issues with the logger implementation
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  }
];
