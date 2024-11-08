/** @typedef  {import("prettier").Config} PrettierConfig */
/** @typedef  {import("@trivago/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig } */
const config = {
  tabWidth: 2,
  useTabs: false,
  semi: true,
  printWidth: 80,
  singleQuote: true,
  arrowParens: 'always',
  importOrder: [
    '/^(?!.*\\.css).*/',
    '^server-only$',
    '^react$',
    '^react-dom$',
    '^next$',
    '^next/(.*)$',
    '^@supabase/supabase-js$',
    '^@supabase/gotrue-js$',
    '<THIRD_PARTY_MODULES>',
    '^@kit/(.*)$', // package imports
    '^~/(.*)$', // app-specific imports
    '^[./]', // relative imports
  ],
  tailwindFunctions: ['tw', 'clsx', 'cn', 'cva'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  plugins: [
    import.meta.resolve('@trivago/prettier-plugin-sort-imports'),
    import.meta.resolve('prettier-plugin-tailwindcss'),
  ],
};

export default config;
