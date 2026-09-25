import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'graphify-out/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { parserOptions: { projectService: false } },
  },
);
