/**
 * Update CHANGELOG.md for a version bump.
 *
 * Used as the npm `version` lifecycle script (after package.json version is
 * updated, before the version commit). Compares the previous git tag to HEAD
 * and prepends a Keep-a-Changelog style section.
 *
 *   node scripts/update-changelog.mjs           # use package.json version
 *   node scripts/update-changelog.mjs 1.2.3     # explicit version
 *   node scripts/update-changelog.mjs --init    # rebuild full history from tags
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = join(root, '..');
const changelogPath = join(root, 'CHANGELOG.md');
const pkgPath = join(root, 'package.json');

const HEADER = `# Changelog

All notable changes to \`@binaryoperations/json-tree-editor\` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

function sh(cmd, cwd = monorepoRoot) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function packageVersion() {
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
}

function listTags() {
  try {
    const out = sh("git tag -l 'v*' --sort=v:refname");
    if (!out) return [];
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function previousTag(tags, currentVersion) {
  const currentTag = `v${currentVersion}`;
  const idx = tags.lastIndexOf(currentTag);
  if (idx > 0) return tags[idx - 1];
  // Version not tagged yet (version lifecycle): last tag is previous.
  if (idx === -1 && tags.length > 0) return tags[tags.length - 1];
  return null;
}

/**
 * @returns {{ hash: string, subject: string }[]}
 */
function commitsBetween(fromRef, toRef = 'HEAD') {
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  let out;
  try {
    out = sh(`git log ${range} --pretty=format:%H%x09%s --no-merges`);
  } catch {
    return [];
  }
  if (!out) return [];
  return out.split('\n').map((line) => {
    const tab = line.indexOf('\t');
    return {
      hash: line.slice(0, tab),
      subject: line.slice(tab + 1),
    };
  });
}

function isVersionBumpCommit(subject) {
  return /^v?\d+\.\d+\.\d+/.test(subject.trim());
}

/**
 * Conventional-commit style buckets.
 * @param {{ hash: string, subject: string }[]} commits
 */
function categorize(commits) {
  /** @type {Record<string, string[]>} */
  const buckets = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: [],
    Docs: [],
    Chore: [],
    Other: [],
  };

  for (const { subject } of commits) {
    if (isVersionBumpCommit(subject)) continue;

    const m = /^(feat|fix|docs|refactor|perf|test|chore|build|ci|style|revert)(\(.+\))?!?:\s*(.+)$/i.exec(
      subject,
    );
    if (!m) {
      buckets.Other.push(subject);
      continue;
    }
    const type = m[1].toLowerCase();
    const desc = m[3].trim();
    const breaking = subject.includes('!:') || /\(.+\)!:/.test(subject);

    if (breaking) {
      buckets.Changed.push(`**BREAKING:** ${desc}`);
      continue;
    }
    switch (type) {
      case 'feat':
        buckets.Added.push(desc);
        break;
      case 'fix':
        buckets.Fixed.push(desc);
        break;
      case 'docs':
        buckets.Docs.push(desc);
        break;
      case 'refactor':
      case 'perf':
      case 'style':
        buckets.Changed.push(desc);
        break;
      case 'chore':
      case 'build':
      case 'ci':
      case 'test':
        buckets.Chore.push(desc);
        break;
      case 'revert':
        buckets.Changed.push(subject);
        break;
      default:
        buckets.Other.push(desc);
    }
  }

  return buckets;
}

function formatSection(version, date, buckets) {
  const lines = [`## [${version}] - ${date}`, ''];
  let any = false;
  for (const [title, items] of Object.entries(buckets)) {
    if (items.length === 0) continue;
    any = true;
    lines.push(`### ${title}`, '');
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }
  if (!any) {
    lines.push('- No user-facing changes recorded.', '');
  }
  return `${lines.join('\n')}\n`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildFullHistory() {
  const tags = listTags();
  if (tags.length === 0) {
    const version = packageVersion();
    const commits = commitsBetween(null, 'HEAD');
    return (
      HEADER +
      formatSection(version, today(), categorize(commits))
    );
  }

  const parts = [HEADER];
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const tag = tags[i];
    const version = tag.replace(/^v/, '');
    const prev = i > 0 ? tags[i - 1] : null;
    let date;
    try {
      date = sh(`git log -1 --format=%cs ${tag}`);
    } catch {
      date = today();
    }
    // Commits introduced in this release: after previous tag up to this tag.
    const commits = prev
      ? commitsBetween(prev, tag)
      : commitsBetween(null, tag);
    parts.push(formatSection(version, date, categorize(commits)));
  }
  return parts.join('');
}

/**
 * Prepend a section for `version` based on commits since the previous tag.
 */
function updateForVersion(version) {
  const tags = listTags();
  const prev = previousTag(tags, version);
  const commits = commitsBetween(prev, 'HEAD');
  const section = formatSection(version, today(), categorize(commits));

  let body = '';
  if (existsSync(changelogPath)) {
    body = readFileSync(changelogPath, 'utf8');
    // Drop existing header so we re-add a single copy.
    body = body.replace(/^# Changelog\n[\s\S]*?(?=^## )/m, '');
    // If this version section already exists, replace it.
    const re = new RegExp(
      `## \\[${version.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=^## |\\Z)`,
      'm',
    );
    if (re.test(body)) {
      body = body.replace(re, section);
      writeFileSync(changelogPath, HEADER + body.replace(/^\n+/, ''));
      return;
    }
  }

  writeFileSync(
    changelogPath,
    HEADER + section + (body ? body.replace(/^\n+/, '') : ''),
  );
}

const arg = process.argv[2];

if (arg === '--init') {
  writeFileSync(changelogPath, buildFullHistory());
  console.log(`Wrote full changelog → ${changelogPath}`);
  process.exit(0);
}

const version = arg && /^\d+\.\d+\.\d+/.test(arg) ? arg : packageVersion();
updateForVersion(version);
console.log(
  `Updated CHANGELOG.md for v${version} (since ${previousTag(listTags(), version) ?? 'beginning'})`,
);
