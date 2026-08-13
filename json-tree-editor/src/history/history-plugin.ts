/**
 * History plugin — path-scoped undo/redo (PRD v3.1 H1).
 *
 * Product law: **never** store full-document copies on the stack.
 * External whole-doc host writes: `clear` (default) or `skip` — never record.
 */

import { definePlugin } from '../plugin';
import { getAtPath, type JsonPath } from '../lib/json-path';
import { parseJsonSource } from '../lib/parse-json';
import type {
  EditorCommitMeta,
  JsonTreeEditorPlugin,
  TransactionEvent,
} from '../lib/editor-runtime/types';
import {
  canRedo as stackCanRedo,
  canUndo as stackCanUndo,
  clearPathStack,
  confirmRedo,
  confirmUndo,
  createPathStack,
  makePathAdd,
  makePathRemove,
  makePathRename,
  makePathReorder,
  makePathReplace,
  objectKeyIndex,
  planRedo,
  planUndo,
  readHistory as stackReadHistory,
  recordEntry,
} from './path-stack';
import type { HistoryEntry, HistoryPluginOptions } from './types';

const WARNED = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (WARNED.has(key)) return;
  WARNED.add(key);
  console.warn(`[json-tree-editor:history] ${message}`);
}

/**
 * Resolve a JSON root for snapshot extraction.
 * Prefers structured roots; falls back to parse of document string.
 */
function rootFromString(value: string): unknown {
  const parsed = parseJsonSource(value);
  if (parsed.ok) return parsed.value;
  if (parsed.value !== undefined) return parsed.value;
  // Syntax error — best-effort JSON.parse
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function resolveAfterRoot(e: TransactionEvent): unknown {
  if (e.tr.nextRoot !== undefined) return e.tr.nextRoot;
  return rootFromString(e.value);
}

function resolveBeforeRoot(e: TransactionEvent, cached: unknown | undefined): unknown {
  if (cached !== undefined) return cached;
  return rootFromString(e.prevValue);
}

function shouldSkipRecord(meta: EditorCommitMeta): boolean {
  if (meta.skipHistory) return true;
  if (meta.echo) return true;
  return false;
}

/**
 * Build a path-scoped history entry from a transaction event.
 * Returns null to skip (missing meta, plugin without path, external, …).
 */
export function buildHistoryEntry(
  e: TransactionEvent,
  beforeRoot: unknown,
  afterRoot: unknown,
): HistoryEntry | null {
  const meta = e.tr.meta;
  const origin = meta.origin;
  const kind = meta.kind;

  if (kind === 'external') return null;
  if (kind === 'unknown') return null;

  // plugin without usable path enrichment → skip (no full-doc)
  if (kind === 'plugin' && meta.path === undefined && meta.newPath === undefined) {
    return null;
  }

  switch (kind) {
    case 'set-value':
    case 'type-change':
    case 'clear': {
      const path = meta.path;
      if (path === undefined) {
        warnOnce('missing-path-replace', `skip ${kind}: missing path`);
        return null;
      }
      const before = getAtPath(beforeRoot, path);
      const after = getAtPath(afterRoot, path);
      if (before === undefined && after === undefined) {
        warnOnce(
          `missing-value-${kind}`,
          `skip ${kind}: path missing on both roots`,
        );
        return null;
      }
      // clear is path-replace only (no fork)
      return makePathReplace({
        path,
        before,
        after,
        coalesceKey: meta.coalesceKey,
        origin,
        commitKind: kind,
      });
    }

    case 'delete': {
      const path = meta.path;
      if (path === undefined || path.length === 0) {
        warnOnce('missing-path-delete', 'skip delete: missing path');
        return null;
      }
      const value = getAtPath(beforeRoot, path);
      if (value === undefined) {
        warnOnce('missing-delete-value', 'skip delete: path missing on before root');
        return null;
      }
      let keyIndex: number | undefined;
      const parentPath = path.slice(0, -1);
      const last = path[path.length - 1];
      if (typeof last === 'string') {
        keyIndex = objectKeyIndex(getAtPath(beforeRoot, parentPath), last);
      }
      return makePathRemove({
        path,
        value,
        keyIndex,
        origin,
      });
    }

    case 'add':
    case 'duplicate': {
      const newPath =
        meta.newPath ??
        (meta.path !== undefined && meta.newKey !== undefined
          ? ([...meta.path, meta.newKey] as JsonPath)
          : meta.path !== undefined && meta.newIndex !== undefined
            ? ([...meta.path, meta.newIndex] as JsonPath)
            : undefined);
      if (!newPath) {
        warnOnce(
          `missing-newPath-${kind}`,
          `skip ${kind}: missing newPath (meta enrichment required)`,
        );
        return null;
      }
      const value = getAtPath(afterRoot, newPath);
      if (value === undefined) {
        warnOnce(
          `missing-add-value-${kind}`,
          `skip ${kind}: newPath missing on after root`,
        );
        return null;
      }
      let keyIndex: number | undefined;
      const last = newPath[newPath.length - 1];
      if (typeof last === 'string') {
        const parentPath = newPath.slice(0, -1);
        keyIndex = objectKeyIndex(getAtPath(afterRoot, parentPath), last);
      }
      return makePathAdd({
        path: newPath,
        value,
        keyIndex,
        origin,
        commitKind: kind,
      });
    }

    case 'rename': {
      const path = meta.path;
      const toKey = meta.toKey;
      if (!path || path.length === 0 || toKey == null || toKey.length === 0) {
        warnOnce(
          'missing-rename-meta',
          'skip rename: need path (old) + toKey',
        );
        return null;
      }
      const last = path[path.length - 1];
      if (typeof last !== 'string') {
        warnOnce('rename-non-string', 'skip rename: path key is not a string');
        return null;
      }
      return makePathRename({
        parentPath: path.slice(0, -1),
        fromKey: last,
        toKey,
        origin,
      });
    }

    case 'reorder': {
      const arrayPath = meta.path;
      const { fromIndex, toIndex } = meta;
      if (
        arrayPath === undefined ||
        typeof fromIndex !== 'number' ||
        typeof toIndex !== 'number' ||
        !Number.isFinite(fromIndex) ||
        !Number.isFinite(toIndex)
      ) {
        warnOnce(
          'missing-reorder-meta',
          'skip reorder: need path + fromIndex + toIndex',
        );
        return null;
      }
      if (fromIndex === toIndex) return null;
      return makePathReorder({
        arrayPath,
        fromIndex,
        toIndex,
        origin,
      });
    }

    case 'plugin': {
      // Optional: plugin can emit path-replace when path is set
      const path = meta.path;
      if (path === undefined) return null;
      const before = getAtPath(beforeRoot, path);
      const after = getAtPath(afterRoot, path);
      return makePathReplace({
        path,
        before,
        after,
        coalesceKey: meta.coalesceKey,
        origin,
        commitKind: kind,
      });
    }

    default:
      return null;
  }
}

/**
 * Create the history plugin.
 *
 * Commands (exclusive masters): `undo`, `redo`, `canUndo`, `canRedo`,
 * `readHistory`, `clearHistory`.
 */
export function historyPlugin(
  options: HistoryPluginOptions = {},
): JsonTreeEditorPlugin {
  const maxDepth = options.maxDepth;
  const enabled = options.enabled !== false;
  const externalPolicy = options.externalPolicy ?? 'clear';

  return definePlugin({
    name: 'history',
    setup(ctx) {
      const stack = createPathStack({ maxDepth });
      /** Last applied document root for before-extraction (avoid double-parse). */
      let lastRoot: unknown | undefined = (() => {
        try {
          return rootFromString(ctx.getValue());
        } catch {
          return undefined;
        }
      })();

      let applying = false;

      const unsub = ctx.onTransaction((e) => {
        if (!enabled) {
          // Still track lastRoot for future enable? keep updated.
          const after = resolveAfterRoot(e);
          if (after !== undefined) lastRoot = after;
          return;
        }

        // Our own undo/redo apply — never re-record
        if (applying || e.tr.meta.skipHistory) {
          const after = resolveAfterRoot(e);
          if (after !== undefined) lastRoot = after;
          return;
        }

        // External whole-document host write
        if (e.tr.meta.origin === 'host' && e.tr.meta.kind === 'external') {
          if (externalPolicy === 'clear') {
            clearPathStack(stack);
          }
          // skip: keep stacks
          const after = resolveAfterRoot(e);
          if (after !== undefined) lastRoot = after;
          return;
        }

        if (shouldSkipRecord(e.tr.meta)) {
          const after = resolveAfterRoot(e);
          if (after !== undefined) lastRoot = after;
          return;
        }

        const beforeRoot = resolveBeforeRoot(e, lastRoot);
        const afterRoot = resolveAfterRoot(e);
        if (beforeRoot === undefined || afterRoot === undefined) {
          if (afterRoot !== undefined) lastRoot = afterRoot;
          return;
        }

        const entry = buildHistoryEntry(e, beforeRoot, afterRoot);
        if (entry) {
          recordEntry(stack, entry, beforeRoot);
        }

        lastRoot = afterRoot;
      });

      const onSubordinate = (info: {
        command: string;
        masterPluginName: string;
      }) => {
        console.error(
          `[json-tree-editor:history] command "${info.command}" is subordinate; master is "${info.masterPluginName}". History plugin is inert for that command.`,
        );
      };

      const exclusive = { exclusive: true as const, onBecomeSubordinate: onSubordinate };

      ctx.registerCommand(
        'undo',
        () => {
          if (!enabled) return false;
          if (applying) return false;
          const state = ctx.getState();
          // Prefer structured root from state when validity ok; else parse value
          let root: unknown = state.root;
          const fromValue = rootFromString(ctx.getValue());
          if (fromValue !== undefined) root = fromValue;

          const planned = planUndo(stack, root);
          if (!planned.ok) return false;

          applying = true;
          try {
            const ok = ctx.setValue(planned.root, {
              kind: 'plugin',
              skipHistory: true,
            });
            if (!ok) return false;
            confirmUndo(stack);
            lastRoot = planned.root;
            return true;
          } finally {
            applying = false;
          }
        },
        exclusive,
      );

      ctx.registerCommand(
        'redo',
        () => {
          if (!enabled) return false;
          if (applying) return false;
          let root: unknown = ctx.getState().root;
          const fromValue = rootFromString(ctx.getValue());
          if (fromValue !== undefined) root = fromValue;

          const planned = planRedo(stack, root);
          if (!planned.ok) return false;

          applying = true;
          try {
            const ok = ctx.setValue(planned.root, {
              kind: 'plugin',
              skipHistory: true,
            });
            if (!ok) return false;
            confirmRedo(stack);
            lastRoot = planned.root;
            return true;
          } finally {
            applying = false;
          }
        },
        exclusive,
      );

      ctx.registerCommand(
        'canUndo',
        () => enabled && stackCanUndo(stack),
        exclusive,
      );

      ctx.registerCommand(
        'canRedo',
        () => enabled && stackCanRedo(stack),
        exclusive,
      );

      ctx.registerCommand(
        'readHistory',
        () => stackReadHistory(stack),
        exclusive,
      );

      ctx.registerCommand(
        'clearHistory',
        () => {
          clearPathStack(stack);
          return true;
        },
        exclusive,
      );

      return () => {
        unsub();
        clearPathStack(stack);
      };
    },
  });
}
