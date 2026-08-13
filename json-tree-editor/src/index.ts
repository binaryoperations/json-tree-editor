/**
 * Package root: public Solid entry.
 * Only the tree view surface — helpers and primitives live under `./utils`.
 * Plugin types also available from `./plugin`.
 */
export {
  JsonTreeView,
  type JsonTreeViewProps,
  type JsonTreeViewHandle,
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
  RegisterCommandOptions,
  RegisterCommandResult,
  TransactionEvent,
} from './lib/editor-runtime/types';

export { definePlugin } from './plugin';
