import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const nextEslintConfig = [
  ...compat.config({
    extends: ['plugin:@next/next/recommended'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'no-undef': 'off'
    },
  }),
];

export default nextEslintConfig;
