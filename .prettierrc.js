module.exports = {
  printWidth: 100,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  proseWrap: 'preserve',
  plugins: ['prettier-plugin-sql'],
  overrides: [
    {
      files: '*.sql',
      options: {
        parser: 'sql',
        language: 'sqlite',
        keywordCase: 'upper',
        linesBetweenQueries: 1,
      },
    },
  ],
};
