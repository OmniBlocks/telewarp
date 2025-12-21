/** @type {import("prettier").Config} */
module.exports = {
  // Indentation
  tabWidth: 2,
  useTabs: false,

  // Semicolons and quotes
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',

  // Trailing commas
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',

  // Line endings
  endOfLine: 'lf',
  printWidth: 100,

  // File-specific overrides
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
      },
    },
    {
      files: '*.json',
      options: {
        tabWidth: 2,
        printWidth: 120,
      },
    },
    {
      files: ['*.html', '*.css', '*.scss'],
      options: {
        tabWidth: 2,
        printWidth: 120,
      },
    },
  ],
}
