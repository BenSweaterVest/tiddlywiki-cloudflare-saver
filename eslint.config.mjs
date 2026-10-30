import js from '@eslint/js';
import globals from 'globals';

const style = {
  'indent': ['error', 2, { SwitchCase: 0 }],
  'linebreak-style': ['error', 'unix'],
  'quotes': ['error', 'single', { avoidEscape: true }],
  'semi': ['error', 'always'],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
  'prefer-const': 'error',
  'no-var': 'error',
  'eqeqeq': ['error', 'always'],
  'object-shorthand': 'error',
  'prefer-template': 'error'
};

export default [
  { ignores: ['node_modules/', 'dist/', 'worker/src/generated/', 'worker/node_modules/', 'worker/.wrangler/'] },
  js.configs.recommended,
  {
    // TiddlyWiki plugin modules: CommonJS-style, run in the browser.
    files: ['plugin/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.browser, $tw: 'readonly', Buffer: 'readonly' }
    },
    rules: style
  },
  {
    // Cloudflare Worker: ES modules, web platform APIs.
    files: ['worker/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.serviceworker, FixedLengthStream: 'readonly' }
    },
    rules: style
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
    rules: style
  },
  {
    files: ['test/**/*.js', 'test/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: style
  },
  {
    // Callbacks passed to page.evaluate() run in the browser.
    files: ['test/e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, $tw: 'readonly' } }
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: { sourceType: 'module' }
  }
];
