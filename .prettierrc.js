module.exports = {
  printWidth: 100,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  proseWrap: 'preserve',
  // prettier-plugin-jsdoc options
  tsdoc: true,
  plugins: ['prettier-plugin-jsdoc'],
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
