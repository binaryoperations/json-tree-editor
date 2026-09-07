import type { JsonPath } from '../lib/json-path';

/** Path-scoped replace of a subtree (set-value, type-change, clear). */
export type PathReplaceEntry = {
  kind: 'path-replace';
  path: JsonPath;
  /** Deep clone of subtree only — never full document unless path is `[]`. */
  before: unknown;
  after: unknown;
  coalesceKey?: string;
  origin: string;
  commitKind: string;
};

/** Object key rename. */
export type PathRenameEntry = {
  kind: 'path-rename';
  parentPath: JsonPath;
  fromKey: string;
  toKey: string;
  origin: string;
  commitKind: 'rename';
};

/** Array sibling reorder. */
export type PathReorderEntry = {
  kind: 'path-reorder';
  arrayPath: JsonPath;
  fromIndex: number;
  toIndex: number;
  origin: string;
  commitKind: 'reorder';
};

/** Node added (add / duplicate). */
export type PathAddEntry = {
  kind: 'path-add';
  /** Full path of the new node. */
  path: JsonPath;
  value: unknown;
  /** Object key insert position for order restore; optional for arrays. */
  keyIndex?: number;
  origin: string;
  commitKind: 'add' | 'duplicate';
};

/** Node removed (delete). */
export type PathRemoveEntry = {
  kind: 'path-remove';
  path: JsonPath;
  value: unknown;
  /** Object: index among keys before delete. Array: implied by path index. */
  keyIndex?: number;
  origin: string;
  commitKind: 'delete';
};

export type HistoryEntry =
  | PathReplaceEntry
  | PathRenameEntry
  | PathReorderEntry
  | PathAddEntry
  | PathRemoveEntry;

export type HistoryExternalPolicy = 'clear' | 'skip';

export type HistoryPluginOptions = {
  /** Max undo entries (default 100). */
  maxDepth?: number;
  /** When false, plugin records nothing and commands are no-ops. Default true. */
  enabled?: boolean;
  /**
   * Host whole-document external writes:
   * - `clear` (default): wipe undo/redo
   * - `skip`: keep stacks (apply guards fail closed on drift)
   *
   * Full-document record is **forbidden**.
   */
  externalPolicy?: HistoryExternalPolicy;
};

export type HistoryBackendId = 'local-path-stack';

/** Lightweight stack inspection (no full entry bodies by default). */
export type HistoryReadSnapshot = {
  backend: HistoryBackendId;
  undoDepth: number;
  redoDepth: number;
  /** Approximate serialized byte size of stacked subtree payloads. */
  approxBytes: number;
  entries: HistoryEntryMeta[];
};

export type HistoryEntryMeta = {
  kind: HistoryEntry['kind'];
  commitKind: string;
  origin: string;
  coalesceKey?: string;
  /** Path hint for UI (node path / array path / parent+keys). */
  pathHint: JsonPath;
  approxBytes: number;
};

export type PathStackOptions = {
  maxDepth?: number;
};

export type PathStackState = {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
  maxDepth: number;
};
