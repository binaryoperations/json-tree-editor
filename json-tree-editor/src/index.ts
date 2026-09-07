/**
 * Package root: public Solid entry.
 * Only the tree view surface — helpers and primitives live under `./utils`.
 * Plugin types also available from `./plugin`.
 */
export {
  JsonTreeView,
  type JsonTreeViewProps,
  type JsonTreeViewHandle,
  type RevealOptions,
} from './components/primitives/JsonTreeView';

export type {
  EditorCommitKind,
  EditorCommitMeta,
  EditorCommitMetaInput,
  EditorCommitOrigin,
  EditorStateSnapshot,
  EditorTransaction,
  JsonTreeEditorPlugin,
  PluginContext,
  PluginRenderStage,
  RegisterCommandOptions,
  RegisterCommandResult,
  TransactionEvent,
} from './lib/editor-runtime/types';

export { definePlugin } from './plugin';

// Utilities — RFC 6901 JSON Pointer ↔ JsonPath
export { pointerToJsonPath, jsonPathToPointer } from './lib/json-path-utils';
