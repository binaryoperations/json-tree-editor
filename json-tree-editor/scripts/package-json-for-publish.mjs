/**
 * Publish-time package.json helpers.
 *
 * Flow (safe if pack/postpack fails):
 * 1. prepack builds the WC, then strips package.json (backup first).
 * 2. npm/pnpm packs the stripped package.json.
 * 3. postpack restores from package.json.publish-backup.
 *
 * If anything dies between strip and restore, the backup remains on disk.
 * Recovery (no package scripts required):
 *   node scripts/package-json-for-publish.mjs restore
 * Also auto-heals on the next monorepo `pnpm build:lib` / `pnpm test`.
 */
import {
  copyFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const backupPath = join(root, 'package.json.publish-backup');

/** Fields that remain on the published package. */
const PUBLISH_KEYS = [
  'name',
  'version',
  'description',
  'type',
  'license',
  'author',
  'homepage',
  'bugs',
  'repository',
  'sideEffects',
  'main',
  'module',
  'types',
  'exports',
  'peerDependencies',
  'peerDependenciesMeta',
  'keywords',
];

export function hasPublishBackup() {
  return existsSync(backupPath);
}

/**
 * Restore monorepo package.json if a publish backup exists.
 * Idempotent; safe when there is no backup.
 */
export function restorePackageJson() {
  if (!existsSync(backupPath)) {
    return false;
  }
  copyFileSync(backupPath, pkgPath);
  try {
    unlinkSync(backupPath);
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Replace package.json with the consumer-facing surface.
 * Always backs up the full monorepo file first (reads backup as source of truth
 * if package.json was already stripped).
 */
export function stripPackageJsonForPublish() {
  // Ensure we have a full monorepo snapshot to restore later.
  if (!existsSync(backupPath)) {
    copyFileSync(pkgPath, backupPath);
  }
  const source = JSON.parse(readFileSync(backupPath, 'utf8'));

  const clean = {};
  for (const key of PUBLISH_KEYS) {
    if (source[key] !== undefined) clean[key] = source[key];
  }
  // WC-only consumers do not need solid-js; Solid path still lists it as a peer.
  clean.peerDependenciesMeta = {
    'solid-js': { optional: true },
  };
  writeFileSync(pkgPath, `${JSON.stringify(clean, null, 2)}\n`);
  return clean;
}

// CLI — works even when package.json has no "scripts" field.
const mode = process.argv[2];
const isCli =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith('package-json-for-publish.mjs') ||
    process.argv[1].endsWith('package-json-for-publish.js'));

if (isCli && mode) {
  if (mode === 'restore') {
    if (restorePackageJson()) {
      console.log('package.json restored from publish backup');
    } else {
      console.log('package.json already in monorepo form (no backup)');
    }
    process.exit(0);
  }
  if (mode === 'strip') {
    stripPackageJsonForPublish();
    console.log('package.json stripped for publish');
    process.exit(0);
  }
  console.error(
    'Usage: node scripts/package-json-for-publish.mjs <strip|restore>',
  );
  process.exit(1);
}
