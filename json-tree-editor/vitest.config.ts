import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid()],
  test: {
    name: 'json-tree-editor',
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: false,
    globals: false,
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
