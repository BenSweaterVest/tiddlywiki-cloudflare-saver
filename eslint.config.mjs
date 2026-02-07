// ESLint flat config for ESLint v9
// See: https://eslint.org/docs/latest/use/configure/migration-guide

export default [
  {
    files: ['src/**/*.js', 'demo/**/*.js', 'scripts/**/*.js', '__tests__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        $tw: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        btoa: 'readonly',
        TextEncoder: 'readonly',
        Blob: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'semi': ['error', 'always'],
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_', 
        'varsIgnorePattern': '^_',
        'caughtErrors': 'none'
      }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      'object-shorthand': 'warn'
    }
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      '*.min.js'
    ]
  }
];
