// @ts-check
import tseslint from 'typescript-eslint';
import astroPlugin from 'eslint-plugin-astro';

export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', '.netlify/**', 'node_modules/**', '**/*.generated.*'],
  },
  tseslint.configs.recommended,
  astroPlugin.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
