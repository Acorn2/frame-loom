import eslint from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'dist-types/**', 'node_modules/**', 'projects/**/output/**', 'designs/**']
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off'
    }
  }
];
