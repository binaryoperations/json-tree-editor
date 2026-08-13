import type { JsonRootValue, JsonValidity } from '../parse-json';
import { EMPTY_ROOT, stringifyJsonDocument } from '../parse-json';
import { CommandRegistry } from './command-registry';
import { buildCommitMeta } from './meta';
import { PluginHost } from './plugin-host';
import type {
  EditorCommitMetaInput,
  EditorStateSnapshot,
  EditorTransaction,
  JsonTreeEditorPlugin,
  PluginContext,
  TransactionEvent,
} from './types';

const MAX_REENTRY_DEPTH = 8;

export type EditorRuntime = {
  getValue(): string;
  getSnapshot(): EditorStateSnapshot;

  dispatch(tr: EditorTransaction): boolean;
  commitUi(nextRoot: unknown, partial?: EditorCommitMetaInput): boolean;

  handleHostValue(next: string): void;

  setReadOnly(ro: boolean): void;
  setOnChange(fn: (pretty: string) => void): void;
  setRootProvider(fn: () => JsonRootValue): void;
  setValidityProvider(fn: () => JsonValidity): void;

  setPlugins(plugins: JsonTreeEditorPlugin[]): void;
  use(plugin: JsonTreeEditorPlugin): () => void;
  callCommand<T = unknown>(name: string, ...args: unknown[]): T | undefined;
  hasCommand(name: string): boolean;

  /** True after first plugin registration (one-way for instance lifetime). */
  isFull(): boolean;

  dispose(): void;
};

export function createEditorRuntime(options: {
  initialValue: string;
  onChange: (pretty: string) => void;
  readOnly?: boolean;
}): EditorRuntime {
  let currentValue = options.initialValue;
  /** Set only when core calls onChange. Null until first emit. */
  let lastEmitted: string | null = null;
  let readOnly = options.readOnly ?? false;
  let onChange = options.onChange;
  let rootProvider: () => JsonRootValue = () => EMPTY_ROOT;
  let validityProvider: () => JsonValidity = () => ({
    ok: true,
    pretty: stringifyJsonDocument(EMPTY_ROOT),
    value: EMPTY_ROOT,
  });

  let commands: CommandRegistry | null = null;
  let host: PluginHost | null = null;
  let full = false;
  let disposed = false;

  /** Serializes outer dispatch + re-entrant flush. */
  let dispatchActive = false;
  const pendingQueue: EditorTransaction[] = [];

  function snapshot(): EditorStateSnapshot {
    return {
      value: currentValue,
      root: rootProvider(),
      validity: validityProvider(),
      readOnly,
    };
  }

  function ensureFull(): void {
    if (full) return;
    full = true;
    commands = new CommandRegistry();
    host = new PluginHost(commands, createPluginContext);
  }

  function createPluginContext(pluginName: string): PluginContext {
    return {
      pluginName,
      contextVersion: 1,

      getState: () => snapshot(),
      getValue: () => currentValue,

      dispatch: (tr) => {
        // FR-21: no new dispatch after this plugin's teardown starts.
        if (host?.isTearingDown(pluginName)) return false;
        return dispatch(tr);
      },

      setValue: (prettyOrRoot, meta) => {
        if (host?.isTearingDown(pluginName)) return false;
        // Sugar only — always goes through dispatch (FR-2).
        const base = buildCommitMeta('plugin', {
          kind: meta?.kind ?? 'plugin',
          path: meta?.path,
          coalesceKey: meta?.coalesceKey,
          skipHistory: meta?.skipHistory ?? false,
          echo: false,
          toKey: meta?.toKey,
          fromIndex: meta?.fromIndex,
          toIndex: meta?.toIndex,
          newPath: meta?.newPath,
          newKey: meta?.newKey,
          newIndex: meta?.newIndex,
        });
        if (typeof prettyOrRoot === 'string') {
          return dispatch({ nextValue: prettyOrRoot, meta: base });
        }
        return dispatch({ nextRoot: prettyOrRoot, meta: base });
      },

      onTransaction: (cb) => {
        ensureFull();
        return host!.onTransaction(cb, pluginName);
      },

      registerCommand: (name, impl, opts) => {
        ensureFull();
        return commands!.register(pluginName, name, impl, opts);
      },

      callCommand: (name, ...args) => {
        if (!commands) return undefined;
        return commands.callCommand(name, ...args);
      },

      hasCommand: (name) => {
        if (!commands) return false;
        return commands.hasCommand(name);
      },
    };
  }

  function shouldEmit(tr: EditorTransaction): boolean {
    if (tr.meta.echo) return false;
    const origin = tr.meta.origin;
    return origin === 'ui' || origin === 'plugin';
  }

  /**
   * Exactly one of nextRoot | nextValue.
   * Returns resolved string, or null if invalid shape.
   */
  function resolveNextString(tr: EditorTransaction): string | null {
    const hasRoot = tr.nextRoot !== undefined;
    const hasValue = tr.nextValue !== undefined;
    if (hasRoot === hasValue) {
      // both or neither
      return null;
    }
    if (hasRoot) {
      // May throw — do not catch silently (architecture).
      return stringifyJsonDocument(tr.nextRoot);
    }
    return tr.nextValue as string;
  }

  /**
   * Apply one transaction: mutate currentValue, maybe emit, maybe notify.
   * Re-entrant dispatch from notify is queued on `pendingQueue`.
   */
  function applyOne(tr: EditorTransaction): boolean {
    if (disposed) return false;
    if (readOnly) return false;

    const nextString = resolveNextString(tr);
    if (nextString === null) return false;

    const prevValue = currentValue;
    if (nextString === prevValue) {
      // Pure no-op — no emit, no notify.
      return false;
    }

    currentValue = nextString;
    // Plugins (e.g. history) must see the transaction *before* the host
    // onChange so that canUndo/canRedo/readHistory are already updated when
    // hosts re-query in their onChange handlers. Emit after notify; undo/redo
    // still use apply-then-confirm (confirm* after setValue returns).
    const willEmit = shouldEmit(tr);
    if (willEmit) {
      lastEmitted = nextString;
    }

    if (host) {
      const event: TransactionEvent = {
        tr,
        value: currentValue,
        prevValue,
        didEmit: willEmit,
        state: snapshot(),
      };
      // Notify while dispatchActive so re-entrant dispatch queues.
      host.notifyTransaction(event);
    }

    if (willEmit) {
      onChange(nextString);
    }

    return true;
  }

  function dispatch(tr: EditorTransaction): boolean {
    if (disposed) return false;
    if (readOnly) return false;

    // Validate shape early even when queueing, so callers get false for junk.
    if (resolveNextString(tr) === null) return false;

    if (dispatchActive) {
      // Re-entrant from onTransaction — queue; count as accepted.
      pendingQueue.push(tr);
      return true;
    }

    dispatchActive = true;
    try {
      const result = applyOne(tr);
      let depth = 1;
      while (pendingQueue.length > 0) {
        depth += 1;
        if (depth > MAX_REENTRY_DEPTH) {
          console.error(
            `[json-tree-editor] dispatch re-entry depth exceeded (max ${MAX_REENTRY_DEPTH}); dropping queued transactions`,
          );
          pendingQueue.length = 0;
          break;
        }
        const next = pendingQueue.shift()!;
        applyOne(next);
      }
      return result;
    } finally {
      dispatchActive = false;
    }
  }

  function commitUi(
    nextRoot: unknown,
    partial: EditorCommitMetaInput = {},
  ): boolean {
    return dispatch({
      nextRoot,
      meta: buildCommitMeta('ui', {
        ...partial,
        kind: partial.kind ?? 'unknown',
        skipHistory: partial.skipHistory ?? false,
        echo: false,
      }),
    });
  }

  function handleHostValue(next: string): void {
    if (disposed) return;

    // Echo: host wrote back the string we just emitted — silent.
    if (lastEmitted !== null && next === lastEmitted) {
      currentValue = next;
      return;
    }

    // No change.
    if (next === currentValue) {
      return;
    }

    // External host write.
    const prevValue = currentValue;
    currentValue = next;

    if (host) {
      const tr: EditorTransaction = {
        nextValue: next,
        meta: buildCommitMeta('host', {
          kind: 'external',
          skipHistory: false,
          echo: false,
        }),
      };
      const event: TransactionEvent = {
        tr,
        value: next,
        prevValue,
        didEmit: false,
        state: snapshot(),
      };

      // Re-entry protection same as dispatch notify.
      if (dispatchActive) {
        // Unusual: host value mid-dispatch — still notify but avoid nested active.
        host.notifyTransaction(event);
        return;
      }

      dispatchActive = true;
      try {
        host.notifyTransaction(event);
        let depth = 1;
        while (pendingQueue.length > 0) {
          depth += 1;
          if (depth > MAX_REENTRY_DEPTH) {
            console.error(
              `[json-tree-editor] dispatch re-entry depth exceeded (max ${MAX_REENTRY_DEPTH}); dropping queued transactions`,
            );
            pendingQueue.length = 0;
            break;
          }
          const queued = pendingQueue.shift()!;
          applyOne(queued);
        }
      } finally {
        dispatchActive = false;
      }
    }
  }

  function setPlugins(plugins: JsonTreeEditorPlugin[]): void {
    if (disposed) return;
    if (plugins.length === 0 && !full) {
      // Stay thin — nothing to register.
      return;
    }
    ensureFull();
    host!.setPlugins(plugins);
  }

  function use(plugin: JsonTreeEditorPlugin): () => void {
    if (disposed) {
      return () => {
        /* no-op */
      };
    }
    ensureFull();
    return host!.use(plugin);
  }

  function callCommand<T = unknown>(
    name: string,
    ...args: unknown[]
  ): T | undefined {
    if (!commands) return undefined;
    return commands.callCommand<T>(name, ...args);
  }

  function hasCommand(name: string): boolean {
    if (!commands) return false;
    return commands.hasCommand(name);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    pendingQueue.length = 0;
    if (host) {
      host.disposeAll();
      host = null;
    }
    commands = null;
  }

  return {
    getValue: () => currentValue,
    getSnapshot: snapshot,
    dispatch,
    commitUi,
    handleHostValue,
    setReadOnly: (ro) => {
      readOnly = ro;
    },
    setOnChange: (fn) => {
      onChange = fn;
    },
    setRootProvider: (fn) => {
      rootProvider = fn;
    },
    setValidityProvider: (fn) => {
      validityProvider = fn;
    },
    setPlugins,
    use,
    callCommand,
    hasCommand,
    isFull: () => full,
    dispose,
  };
}
