/**
 * Pure path-scoped history stack (PRD History Plugin v3.1 H0).
 *
 * **Product law:** never store full-document copies on the stack.
 * Entries hold subtree clones or O(1) structural ops only.
 */

import { isSessionCoalesceKey } from '../lib/editor-runtime/meta';
import {
  deepCloneJson,
  deleteAtPath,
  getAtPath,
  insertAtPath,
  moveArrayItemAtPath,
  pathKey,
  renameKeyAtPath,
  setAtPath,
  type JsonPath,
} from '../lib/json-path';
import type {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryReadSnapshot,
  PathAddEntry,
  PathRemoveEntry,
  PathRenameEntry,
  PathReorderEntry,
  PathReplaceEntry,
  PathStackOptions,
  PathStackState,
} from './types';

const DEFAULT_MAX_DEPTH = 100;

// ── Equality ──────────────────────────────────────────────

/**
 * JSON value equality on a subtree (not reference equality).
 * Uses canonical `JSON.stringify` so key order participates.
 */
export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  // Primitives (incl. undefined mismatch)
  if (typeof a !== 'object') return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// ── Size / meta ───────────────────────────────────────────

/** Approximate UTF-16 code-unit size of a JSON-serializable payload. */
export function approxJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function entryApproxBytes(entry: HistoryEntry): number {
  switch (entry.kind) {
    case 'path-replace':
      return approxJsonBytes(entry.before) + approxJsonBytes(entry.after);
    case 'path-add':
    case 'path-remove':
      return approxJsonBytes(entry.value);
    case 'path-rename':
    case 'path-reorder':
      return 0;
    default:
      return 0;
  }
}

function entryPathHint(entry: HistoryEntry): JsonPath {
  switch (entry.kind) {
    case 'path-replace':
    case 'path-add':
    case 'path-remove':
      return entry.path;
    case 'path-rename':
      return [...entry.parentPath, entry.fromKey];
    case 'path-reorder':
      return entry.arrayPath;
    default:
      return [];
  }
}

export function toEntryMeta(entry: HistoryEntry): HistoryEntryMeta {
  return {
    kind: entry.kind,
    commitKind: entry.commitKind,
    origin: entry.origin,
    coalesceKey: entry.kind === 'path-replace' ? entry.coalesceKey : undefined,
    pathHint: entryPathHint(entry),
    approxBytes: entryApproxBytes(entry),
  };
}

// ── Stack lifecycle ───────────────────────────────────────

export function createPathStack(
  options: PathStackOptions = {},
): PathStackState {
  const maxDepth =
    typeof options.maxDepth === 'number' &&
    Number.isFinite(options.maxDepth) &&
    options.maxDepth > 0
      ? Math.floor(options.maxDepth)
      : DEFAULT_MAX_DEPTH;
  return { undo: [], redo: [], maxDepth };
}

export function clearPathStack(stack: PathStackState): void {
  stack.undo.length = 0;
  stack.redo.length = 0;
}

export function canUndo(stack: PathStackState): boolean {
  return stack.undo.length > 0;
}

export function canRedo(stack: PathStackState): boolean {
  return stack.redo.length > 0;
}

export function readHistory(stack: PathStackState): HistoryReadSnapshot {
  let approxBytes = 0;
  const entries: HistoryEntryMeta[] = [];
  for (const e of stack.undo) {
    const meta = toEntryMeta(e);
    approxBytes += meta.approxBytes;
    entries.push(meta);
  }
  // redo not included in approxBytes body list for "stacked undo" metric;
  // still report depth.
  for (const e of stack.redo) {
    approxBytes += entryApproxBytes(e);
  }
  return {
    backend: 'local-path-stack',
    undoDepth: stack.undo.length,
    redoDepth: stack.redo.length,
    approxBytes,
    entries,
  };
}

function trimUndo(stack: PathStackState): void {
  while (stack.undo.length > stack.maxDepth) {
    stack.undo.shift();
  }
}

function cloneEntryPayloads(entry: HistoryEntry): HistoryEntry {
  switch (entry.kind) {
    case 'path-replace':
      return {
        ...entry,
        path: entry.path.slice(),
        before: deepCloneJson(entry.before),
        after: deepCloneJson(entry.after),
      };
    case 'path-add':
      return {
        ...entry,
        path: entry.path.slice(),
        value: deepCloneJson(entry.value),
      };
    case 'path-remove':
      return {
        ...entry,
        path: entry.path.slice(),
        value: deepCloneJson(entry.value),
      };
    case 'path-rename':
      return {
        ...entry,
        parentPath: entry.parentPath.slice(),
      };
    case 'path-reorder':
      return {
        ...entry,
        arrayPath: entry.arrayPath.slice(),
      };
    default:
      return entry;
  }
}

/**
 * Record a new history entry. Coalesces trailing path-replace when
 * coalesce keys match and continuity holds on `prevRoot`.
 *
 * Always clears redo. Trims to maxDepth.
 */
export function recordEntry(
  stack: PathStackState,
  entry: HistoryEntry,
  prevRoot: unknown,
): void {
  const next = cloneEntryPayloads(entry);

  // Only session-keyed string live edits coalesce (PRD §4 MUST NOT bare path keys).
  if (
    next.kind === 'path-replace' &&
    isSessionCoalesceKey(next.coalesceKey)
  ) {
    const top = stack.undo[stack.undo.length - 1];
    if (
      top &&
      top.kind === 'path-replace' &&
      top.coalesceKey === next.coalesceKey &&
      pathKey(top.path) === pathKey(next.path) &&
      deepEqualJson(getAtPath(prevRoot, next.path), top.after)
    ) {
      top.after = deepCloneJson(next.after);
      stack.redo.length = 0;
      return;
    }
  }

  stack.undo.push(next);
  stack.redo.length = 0;
  trimUndo(stack);
}

// ── Materialize ───────────────────────────────────────────

export type MaterializeResult =
  | { ok: true; root: unknown }
  | { ok: false; reason: string };

function pathsEqual(a: JsonPath, b: JsonPath): boolean {
  return pathKey(a) === pathKey(b);
}

function materializeReplace(
  root: unknown,
  entry: PathReplaceEntry,
  direction: 'undo' | 'redo',
): MaterializeResult {
  const current = getAtPath(root, entry.path);
  if (direction === 'undo') {
    // Continuity: current must still match what we last produced (after).
    if (!deepEqualJson(current, entry.after)) {
      return { ok: false, reason: 'path-replace continuity (after)' };
    }
    return { ok: true, root: setAtPath(root, entry.path, deepCloneJson(entry.before)) };
  }
  // redo: current should match before
  if (!deepEqualJson(current, entry.before)) {
    return { ok: false, reason: 'path-replace continuity (before)' };
  }
  return { ok: true, root: setAtPath(root, entry.path, deepCloneJson(entry.after)) };
}

function materializeRename(
  root: unknown,
  entry: PathRenameEntry,
  direction: 'undo' | 'redo',
): MaterializeResult {
  if (direction === 'undo') {
    const next = renameKeyAtPath(
      root,
      entry.parentPath,
      entry.toKey,
      entry.fromKey,
    );
    if (next === root) {
      return { ok: false, reason: 'path-rename undo failed' };
    }
    return { ok: true, root: next };
  }
  const next = renameKeyAtPath(
    root,
    entry.parentPath,
    entry.fromKey,
    entry.toKey,
  );
  if (next === root) {
    return { ok: false, reason: 'path-rename redo failed' };
  }
  return { ok: true, root: next };
}

function materializeReorder(
  root: unknown,
  entry: PathReorderEntry,
  direction: 'undo' | 'redo',
): MaterializeResult {
  const from = direction === 'undo' ? entry.toIndex : entry.fromIndex;
  const to = direction === 'undo' ? entry.fromIndex : entry.toIndex;
  const itemPath: JsonPath = [...entry.arrayPath, from];
  const next = moveArrayItemAtPath(root, itemPath, to);
  if (next === root) {
    return { ok: false, reason: 'path-reorder move failed' };
  }
  return { ok: true, root: next };
}

function materializeAdd(
  root: unknown,
  entry: PathAddEntry,
  direction: 'undo' | 'redo',
): MaterializeResult {
  if (direction === 'undo') {
    // Undo add = delete at new path
    const existing = getAtPath(root, entry.path);
    if (existing === undefined && entry.path.length > 0) {
      return { ok: false, reason: 'path-add undo: missing node' };
    }
    const next = deleteAtPath(root, entry.path);
    if (next === root && entry.path.length > 0) {
      // deleteAtPath may return same ref only on no-op empty path
      const still = getAtPath(next, entry.path);
      if (still !== undefined) {
        return { ok: false, reason: 'path-add undo: delete failed' };
      }
    }
    return { ok: true, root: next };
  }
  // Redo add = insert value at path
  if (getAtPath(root, entry.path) !== undefined && entry.path.length > 0) {
    // For objects, key might exist; for arrays, index always "exists" as slot.
    // insertAtPath handles object collision as no-op.
  }
  const next = insertAtPath(root, entry.path, deepCloneJson(entry.value), {
    keyIndex: entry.keyIndex,
  });
  if (next === root) {
    return { ok: false, reason: 'path-add redo: insert failed' };
  }
  return { ok: true, root: next };
}

function materializeRemove(
  root: unknown,
  entry: PathRemoveEntry,
  direction: 'undo' | 'redo',
): MaterializeResult {
  if (direction === 'undo') {
    // Undo remove = insert value (+ keyIndex for objects)
    const next = insertAtPath(root, entry.path, deepCloneJson(entry.value), {
      keyIndex: entry.keyIndex,
    });
    if (next === root) {
      return { ok: false, reason: 'path-remove undo: insert failed' };
    }
    return { ok: true, root: next };
  }
  // Redo remove = delete
  const existing = getAtPath(root, entry.path);
  if (existing === undefined && entry.path.length > 0) {
    // For arrays, undefined means missing index — still try delete?
    return { ok: false, reason: 'path-remove redo: missing node' };
  }
  const next = deleteAtPath(root, entry.path);
  return { ok: true, root: next };
}

/**
 * Apply one entry in undo or redo direction. Does **not** mutate stacks.
 * Fail-closed: returns ok:false without a mutated root.
 */
export function materializeEntry(
  root: unknown,
  entry: HistoryEntry,
  direction: 'undo' | 'redo',
): MaterializeResult {
  switch (entry.kind) {
    case 'path-replace':
      return materializeReplace(root, entry, direction);
    case 'path-rename':
      return materializeRename(root, entry, direction);
    case 'path-reorder':
      return materializeReorder(root, entry, direction);
    case 'path-add':
      return materializeAdd(root, entry, direction);
    case 'path-remove':
      return materializeRemove(root, entry, direction);
    default:
      return { ok: false, reason: 'unknown entry kind' };
  }
}

/**
 * Pop undo, materialize, push redo on success.
 * Stacks unchanged on failure (apply-then-confirm: caller should only call
 * after setValue succeeds — this helper is pure stack+root).
 *
 * Pure stack mutation variant used when materialize already succeeded and
 * host setValue confirmed — see {@link applyUndo} / {@link applyRedo} for
 * combined pure materialize without host I/O.
 */
export function peekUndo(stack: PathStackState): HistoryEntry | undefined {
  return stack.undo[stack.undo.length - 1];
}

export function peekRedo(stack: PathStackState): HistoryEntry | undefined {
  return stack.redo[stack.redo.length - 1];
}

/**
 * Compute undo root from current root + top undo entry.
 * Does not mutate stack.
 */
export function planUndo(
  stack: PathStackState,
  root: unknown,
): MaterializeResult & { entry?: HistoryEntry } {
  const entry = peekUndo(stack);
  if (!entry) return { ok: false, reason: 'empty undo' };
  const result = materializeEntry(root, entry, 'undo');
  if (!result.ok) return result;
  return { ok: true, root: result.root, entry };
}

/**
 * Compute redo root from current root + top redo entry.
 * Does not mutate stack.
 */
export function planRedo(
  stack: PathStackState,
  root: unknown,
): MaterializeResult & { entry?: HistoryEntry } {
  const entry = peekRedo(stack);
  if (!entry) return { ok: false, reason: 'empty redo' };
  const result = materializeEntry(root, entry, 'redo');
  if (!result.ok) return result;
  return { ok: true, root: result.root, entry };
}

/** Confirm undo after host setValue succeeded — mutates stacks. */
export function confirmUndo(stack: PathStackState): void {
  const entry = stack.undo.pop();
  if (entry) stack.redo.push(entry);
}

/** Confirm redo after host setValue succeeded — mutates stacks. */
export function confirmRedo(stack: PathStackState): void {
  const entry = stack.redo.pop();
  if (entry) stack.undo.push(entry);
}

/**
 * Pure apply undo: materialize + confirm in one step (no host).
 * For unit tests of stack logic.
 */
export function applyUndo(
  stack: PathStackState,
  root: unknown,
): MaterializeResult {
  const planned = planUndo(stack, root);
  if (!planned.ok) return planned;
  confirmUndo(stack);
  return { ok: true, root: planned.root };
}

/**
 * Pure apply redo: materialize + confirm in one step (no host).
 * For unit tests of stack logic.
 */
export function applyRedo(
  stack: PathStackState,
  root: unknown,
): MaterializeResult {
  const planned = planRedo(stack, root);
  if (!planned.ok) return planned;
  confirmRedo(stack);
  return { ok: true, root: planned.root };
}

// ── Entry builders (from transaction meta + roots) ────────

export function pathsEqualJson(a: JsonPath | undefined, b: JsonPath | undefined): boolean {
  if (!a || !b) return a === b;
  return pathsEqual(a, b);
}

/** Build a path-replace entry from before/after subtrees. */
export function makePathReplace(args: {
  path: JsonPath;
  before: unknown;
  after: unknown;
  coalesceKey?: string;
  origin: string;
  commitKind: string;
}): PathReplaceEntry {
  return {
    kind: 'path-replace',
    path: args.path.slice(),
    before: deepCloneJson(args.before),
    after: deepCloneJson(args.after),
    coalesceKey: args.coalesceKey,
    origin: args.origin,
    commitKind: args.commitKind,
  };
}

export function makePathRename(args: {
  parentPath: JsonPath;
  fromKey: string;
  toKey: string;
  origin: string;
}): PathRenameEntry {
  return {
    kind: 'path-rename',
    parentPath: args.parentPath.slice(),
    fromKey: args.fromKey,
    toKey: args.toKey,
    origin: args.origin,
    commitKind: 'rename',
  };
}

export function makePathReorder(args: {
  arrayPath: JsonPath;
  fromIndex: number;
  toIndex: number;
  origin: string;
}): PathReorderEntry {
  return {
    kind: 'path-reorder',
    arrayPath: args.arrayPath.slice(),
    fromIndex: args.fromIndex,
    toIndex: args.toIndex,
    origin: args.origin,
    commitKind: 'reorder',
  };
}

export function makePathAdd(args: {
  path: JsonPath;
  value: unknown;
  keyIndex?: number;
  origin: string;
  commitKind: 'add' | 'duplicate';
}): PathAddEntry {
  return {
    kind: 'path-add',
    path: args.path.slice(),
    value: deepCloneJson(args.value),
    keyIndex: args.keyIndex,
    origin: args.origin,
    commitKind: args.commitKind,
  };
}

export function makePathRemove(args: {
  path: JsonPath;
  value: unknown;
  keyIndex?: number;
  origin: string;
}): PathRemoveEntry {
  return {
    kind: 'path-remove',
    path: args.path.slice(),
    value: deepCloneJson(args.value),
    keyIndex: args.keyIndex,
    origin: args.origin,
    commitKind: 'delete',
  };
}

/**
 * Object key index among `Object.keys(parent)` before delete, or undefined.
 */
export function objectKeyIndex(
  parent: unknown,
  key: string,
): number | undefined {
  if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
    return undefined;
  }
  const keys = Object.keys(parent as Record<string, unknown>);
  const i = keys.indexOf(key);
  return i >= 0 ? i : undefined;
}
