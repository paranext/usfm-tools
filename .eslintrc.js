module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-null/no-null': 2,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'no-null'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    browser: true,
    node: true,
  },
};
