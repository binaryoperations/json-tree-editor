/**
 * Public history surface: `@binaryoperations/json-tree-editor/history`
 *
 * Path-scoped undo/redo plugin (PRD History Plugin v3.1).
 * **Never** stores full-document copies on the stack.
 *
 * Docs: see `./README.md` in this folder.
 */

export { historyPlugin, buildHistoryEntry } from './history-plugin';

export type {
  HistoryBackendId,
  HistoryEntry,
  HistoryEntryMeta,
  HistoryExternalPolicy,
  HistoryPluginOptions,
  HistoryReadSnapshot,
  PathAddEntry,
  PathRemoveEntry,
  PathRenameEntry,
  PathReorderEntry,
  PathReplaceEntry,
  PathStackOptions,
  PathStackState,
} from './types';

export {
  approxJsonBytes,
  applyRedo,
  applyUndo,
  canRedo,
  canUndo,
  clearPathStack,
  confirmRedo,
  confirmUndo,
  createPathStack,
  deepEqualJson,
  makePathAdd,
  makePathRemove,
  makePathRename,
  makePathReorder,
  makePathReplace,
  materializeEntry,
  objectKeyIndex,
  planRedo,
  planUndo,
  readHistory,
  recordEntry,
  toEntryMeta,
} from './path-stack';
