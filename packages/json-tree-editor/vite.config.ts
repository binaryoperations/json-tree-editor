import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import solid from 'vite-plugin-solid';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Web-component-only library build.
 *
 * Solid consumers import TypeScript source via package exports (no dist/index.js).
 * This build bundles solid-js into dist/web-component.js for framework-agnostic hosts.
 */
export default defineConfig((): UserConfig => {
  return {
    plugins: [
      solid(),
      dts({
        // Only emit types for the WC public surface (not the Solid source entry).
        include: ['src/web-component.tsx', 'src/vite-env.d.ts'],
        exclude: ['src/**/*.css'],
        entryRoot: 'src',
        outDir: 'dist',
        // rollupTypes conflicts with package.json "types" pointing at source.
        rollupTypes: false,
        insertTypesEntry: false,
        copyDtsFiles: false,
        staticImport: true,
      }),
    ],
    build: {
      emptyOutDir: true,
      sourcemap: true,
      minify: 'esbuild',
      lib: {
        entry: resolve(root, 'src/web-component.tsx'),
        formats: ['es'],
        fileName: () => 'web-component.js',
      },
      rollupOptions: {
        // Bundle solid-js (and everything else) into the WC artifact.
        external: [],
        output: {
          assetFileNames: 'assets/[name][extname]',
        },
      },
      // CSS is imported with ?inline in the WC entry — no separate asset needed.
      cssCodeSplit: true,
    },
  };
});
