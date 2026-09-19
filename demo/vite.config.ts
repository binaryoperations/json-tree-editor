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
      // Multi-page: Solid demo + large-tree + plugin pages + vanilla WC
      input: {
        main: resolve(__dirname, 'index.html'),
        large: resolve(__dirname, 'large.html'),
        history: resolve(__dirname, 'history.html'),
        breadcrumb: resolve(__dirname, 'breadcrumb.html'),
        wc: resolve(__dirname, 'wc.html'),
        'wc-history': resolve(__dirname, 'wc-history.html'),
      },
    },
  },
  resolve: {
    // Avoid dual solid-js copies when consuming the workspace library source.
    dedupe: ['solid-js'],
    alias: [
      // Exact matches — a string alias for `…/web-component` would also steal
      // `…/web-component/register` (prefix match → index.tsx/register).
      {
        find: /^@binaryoperations\/json-tree-editor\/web-component\/register$/,
        replacement: resolve(libSrc, 'web-component/register.ts'),
      },
      {
        find: /^@binaryoperations\/json-tree-editor\/web-component$/,
        replacement: resolve(libSrc, 'web-component/index.tsx'),
      },
    ],
  },
  // Ensure Solid JSX from the workspace library is compiled by vite-plugin-solid.
  optimizeDeps: {
    exclude: ['@binaryoperations/json-tree-editor'],
  },
});
