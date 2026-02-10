module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: ['.next', 'dist', 'node_modules'],
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier']
    },
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      env: { browser: true },
      extends: ['next/core-web-vitals', 'prettier']
    }
  ]
};
