/**
 * Public plugin-system contract (PRD v1.1 FREEZE).
 * Re-exported from package root and `./plugin`.
 */

import type { JsonPath } from '../json-path';
import type { JsonRootValue, JsonValidity } from '../parse-json';

// ── Meta ──────────────────────────────────────────────────

export type EditorCommitKind =
  | 'set-value'
  | 'rename'
  | 'type-change'
  | 'add'
  | 'delete'
  | 'clear'
  | 'duplicate'
  | 'reorder'
  | 'external'
  | 'plugin'
  | 'unknown';

export type EditorCommitOrigin = 'ui' | 'host' | 'plugin';

export type EditorCommitMeta = {
  origin: EditorCommitOrigin;
  kind: EditorCommitKind;
  path?: JsonPath;
  coalesceKey?: string;
  skipHistory: boolean;
  echo: boolean;
};

// ── Transaction (document only) ───────────────────────────
// Exactly one of nextRoot | nextValue.

export type EditorTransaction = {
  nextRoot?: unknown;
  nextValue?: string;
  meta: EditorCommitMeta;
};

// ── Snapshot ──────────────────────────────────────────────

export type EditorStateSnapshot = {
  value: string;
  /** Display root: always a JSON object root for the tree (last-good when invalid). */
  root: JsonRootValue;
  validity: JsonValidity;
  readOnly: boolean;
};

// ── Event ─────────────────────────────────────────────────

export type TransactionEvent = {
  tr: EditorTransaction;
  /** Document string after this apply. Prefer for history recording. */
  value: string;
  prevValue: string;
  didEmit: boolean;
  /**
   * Snapshot after apply. `state.root` may still reflect the host-controlled
   * prop until the host echoes `value` — use `tr.nextRoot` / `value` for the
   * post-apply document, not `state.root` alone.
   */
  state: EditorStateSnapshot;
};

// ── Plugin ────────────────────────────────────────────────

export type JsonTreeEditorPlugin = {
  name: string;
  setup(ctx: PluginContext): void | (() => void);
};

export type RegisterCommandResult = {
  role: 'master' | 'subordinate';
  masterPluginName: string;
};

export type RegisterCommandOptions = {
  exclusive?: boolean;
  onBecomeSubordinate?: (info: {
    command: string;
    masterPluginName: string;
  }) => void;
};

export interface PluginContext {
  readonly pluginName: string;
  readonly contextVersion: 1;

  getState(): EditorStateSnapshot;
  getValue(): string;

  dispatch(tr: EditorTransaction): boolean;

  setValue(
    prettyOrRoot: string | unknown,
    meta?: Partial<
      Pick<EditorCommitMeta, 'kind' | 'path' | 'coalesceKey' | 'skipHistory'>
    >,
  ): boolean;

  onTransaction(cb: (e: TransactionEvent) => void): () => void;

  registerCommand(
    name: string,
    impl: (...args: unknown[]) => unknown,
    options?: RegisterCommandOptions,
  ): RegisterCommandResult;

  callCommand<T = unknown>(name: string, ...args: unknown[]): T | undefined;
  hasCommand(name: string): boolean;
}

export type { JsonPath, JsonRootValue, JsonValidity };
