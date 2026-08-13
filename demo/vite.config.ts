import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const libSrc = resolve(__dirname, '../json-tree-editor/src');

export default defineConfig({
  plugins: [solid()],
  server: {
    strictPort: false,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      // Multi-page: Solid demo + large-tree + history plugin + vanilla WC
      input: {
        main: resolve(__dirname, 'index.html'),
        large: resolve(__dirname, 'large.html'),
        history: resolve(__dirname, 'history.html'),
        wc: resolve(__dirname, 'wc.html'),
        'wc-history': resolve(__dirname, 'wc-history.html'),
      },
    },
  },
  resolve: {
    // Avoid dual solid-js copies when consuming the workspace library source.
    dedupe: ['solid-js'],
    alias: {
      // Package "web-component" export points at dist/ (prebundled). Alias to
      // source in the monorepo demo so WC pages pick up live library edits
      // without a rebuild (dist stays for published consumers).
      '@binaryoperations/json-tree-editor/web-component': resolve(
        libSrc,
        'web-component.tsx',
      ),
    },
  },
  // Ensure Solid JSX from the workspace library is compiled by vite-plugin-solid.
  optimizeDeps: {
    exclude: ['@binaryoperations/json-tree-editor'],
  },
});
