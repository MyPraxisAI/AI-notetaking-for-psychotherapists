import eslintConfigBase from '@kit/eslint-config/base.js';

export default [
  ...eslintConfigBase,
  {
    // Add any bg-specific overrides here
    ignores: [
      'dist/**',
      'node_modules/**',
      'scripts/**'
    ]
  }
]; 