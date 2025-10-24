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
  overrides: [
    {
      // Specific configuration for the convert-marble-lexicon.ts file
      files: ['src/convert-marble-lexicon.ts'],
      rules: {
        // Add specific rules for your conversion script
        'no-console': 'off', // Allow console usage in this utility script
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
