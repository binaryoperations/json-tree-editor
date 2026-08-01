import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import solid from 'vite-plugin-solid';

const root = fileURLToPath(new URL('.', import.meta.url));

const solidExternals = [
  'solid-js',
  'solid-js/web',
  'solid-js/store',
  'solid-js/html',
  'solid-js/h',
];

/**
 * Dual library builds:
 * - default (`vite build`): Solid package entry — solid-js external
 * - `--mode web-component`: web component — solid-js bundled inside
 */
export default defineConfig(({ mode }): UserConfig => {
  const isWebComponent = mode === 'web-component';

  return {
    plugins: [
      solid(),
      // Emit types once with the Solid entry (includes web-component.tsx declarations).
      !isWebComponent &&
        dts({
          include: ['src/**/*.ts', 'src/**/*.tsx'],
          exclude: ['src/**/*.css'],
          entryRoot: 'src',
          outDir: 'dist',
          rollupTypes: false,
          insertTypesEntry: false,
          copyDtsFiles: true,
          // web-component is not an input of this build; still emit its .d.ts from source.
          staticImport: true,
        }),
    ].filter(Boolean),
    build: {
      emptyOutDir: !isWebComponent,
      sourcemap: true,
      minify: isWebComponent ? 'esbuild' : false,
      lib: {
        entry: resolve(
          root,
          isWebComponent ? 'src/web-component.tsx' : 'src/index.ts',
        ),
        formats: ['es'],
        fileName: () => (isWebComponent ? 'web-component.js' : 'index.js'),
      },
      rollupOptions: {
        external: isWebComponent
          ? []
          : (id) =>
              solidExternals.some(
                (pkg) => id === pkg || id.startsWith(`${pkg}/`),
              ),
        output: {
          assetFileNames: 'assets/[name][extname]',
        },
      },
      // Keep CSS as a separate file for the Solid entry; WC inlines via ?inline.
      cssCodeSplit: true,
    },
  };
});
