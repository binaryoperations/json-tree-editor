import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 5176,
    strictPort: false,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      // Multi-page: main demo + large-tree stress demo
      input: {
        main: resolve(__dirname, 'index.html'),
        large: resolve(__dirname, 'large.html'),
      },
    },
  },
  resolve: {
    // Avoid dual solid-js copies when consuming the workspace library source.
    dedupe: ['solid-js'],
  },
  // Ensure Solid JSX from the workspace library is compiled by vite-plugin-solid.
  optimizeDeps: {
    exclude: ['json-tree-editor'],
  },
});
