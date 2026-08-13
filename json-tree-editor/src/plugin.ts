/**
 * Public plugin surface for `@binaryoperations/json-tree-editor/plugin`.
 *
 * Plugin authors should import types from here (or the package root) and never
 * depend on internal `createEditorRuntime`.
 */

export type {
  EditorCommitKind,
  EditorCommitMeta,
  EditorCommitMetaInput,
  EditorCommitOrigin,
  EditorStateSnapshot,
  EditorTransaction,
  JsonTreeEditorPlugin,
  PluginContext,
  RegisterCommandOptions,
  RegisterCommandResult,
  TransactionEvent,
} from './lib/editor-runtime/types';

import type { JsonTreeEditorPlugin } from './lib/editor-runtime/types';

/**
 * Identity helper for typed plugin factories.
 *
 * @example
 * export function historyPlugin(opts?: { maxDepth?: number }) {
 *   return definePlugin({
 *     name: 'history',
 *     setup(ctx) { ... },
 *   });
 * }
 */
export function definePlugin(plugin: JsonTreeEditorPlugin): JsonTreeEditorPlugin {
  return plugin;
}
