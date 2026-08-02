/**
 * npm/pnpm prepack lifecycle.
 *
 * - Heals any leftover stripped package.json from a failed pack.
 * - Builds the web component (normal vite build — does not touch package.json).
 * - Strips package.json only after a successful build (backup written first).
 * - On build failure or signal: always restore before exit.
 *
 * postpack restores after a successful pack. If pack dies without postpack,
 * package.json.publish-backup remains; run:
 *   node scripts/package-json-for-publish.mjs restore
 * or any monorepo `pnpm build:lib` / `pnpm test` (they restore first).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  restorePackageJson,
  stripPackageJsonForPublish,
} from './package-json-for-publish.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function restore(reason) {
  if (restorePackageJson()) {
    console.warn(`package.json restored (${reason})`);
  }
}

// Heal from a previous failed pack/publish.
restore('stale publish backup');

const onSignal = (sig) => {
  restore(`signal ${sig}`);
  process.exit(sig === 'SIGINT' ? 130 : 143);
};
process.on('SIGINT', () => onSignal('SIGINT'));
process.on('SIGTERM', () => onSignal('SIGTERM'));

const build = spawnSync('pnpm', ['exec', 'vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (build.status !== 0) {
  restore('build failed');
  process.exit(build.status ?? 1);
}

// Strip only after a green build so a compile error never leaves a dirty tree.
try {
  stripPackageJsonForPublish();
  console.log('package.json stripped for pack (backup: package.json.publish-backup)');
} catch (err) {
  restore('strip failed');
  console.error(err);
  process.exit(1);
}

// Exit 0 with package.json stripped; pack uses it; postpack restores.
// If pack aborts without postpack, backup remains for recovery.
