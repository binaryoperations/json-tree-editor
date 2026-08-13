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
} from './types';

export {
  createEditorRuntime,
  type EditorRuntime,
} from './create-editor-runtime';

export {
  buildCommitMeta,
  isSessionCoalesceKey,
  mintEditSessionId,
  setValueCoalesceKey,
  uiCommitMeta,
} from './meta';

// Internal pieces re-exported for unit tests (not a public package path).
export { CommandRegistry } from './command-registry';
export { PluginHost } from './plugin-host';
