module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', '.ai/', 'apps/api/public/', '*.min.js'],
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
      env: { browser: true },
    },
    {
      files: ['*.cjs', '*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
