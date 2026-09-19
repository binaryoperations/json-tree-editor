import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from '../../json-tree-editor/src';
import {
  historyPlugin,
  type HistoryEntryMeta,
  type HistoryReadSnapshot,
} from '../../json-tree-editor/src/history';
import {
  parseJsonSource,
  type JsonValidity,
} from '../../json-tree-editor/src/utils';
import {
  type Component,
  createMemo,
  createSignal,
  Index,
  Show,
} from 'solid-js';

import { DemoHeader } from './components/DemoHeader';
import { JsonEditor } from './components/JsonEditor';
import { JsonFormatted } from './components/JsonFormatted';

/** Stable plugin instance — identity is by `plugin.name` across re-renders. */
const HISTORY_PLUGINS = [historyPlugin({ maxDepth: 50 })];

/** Sample starter JSON for the history demo. */
const STARTER_JSON = `{
  "id": "hist_01",
  "name": "History demo",
  "active": true,
  "score": 10,
  "notes": null,
  "tags": ["undo", "redo", "path-scoped"],
  "meta": {
    "author": "dev@example.com",
    "version": 1
  },
  "items": [
    { "sku": "A-100", "qty": 2 },
    { "sku": "B-200", "qty": 1 }
  ]
}
`;

/** Copy-friendly Solid bootstrap snippet shown in the demo pane. */
const SOLID_BOOTSTRAP = `import { JsonTreeView } from '@binaryoperations/json-tree-editor';
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';

const plugins = [historyPlugin({ maxDepth: 50 })];

<JsonTreeView
  value={json}
  onChange={setJson}
  plugins={plugins}
  ref={setHandle}
/>

// Undo / inspect
handle.callCommand('undo');
handle.callCommand('canUndo');
handle.callCommand('readHistory');
`;

/**
 * History plugin demo.
 *
 * Tree edits are recorded as path-scoped undo entries (not full-document
 * snapshots). Header Undo / Redo call `handle.callCommand('undo'|'redo')`.
 * Optional source pane shows dual-pane external policy: host rewrites clear
 * tree history by default (`externalPolicy: 'clear'`).
 */
export const HistoryApp: Component = () => {
  const [source, setSource] = createSignal(STARTER_JSON);
  const [showSource, setShowSource] = createSignal(false);
  const [treeHandle, setTreeHandle] = createSignal<JsonTreeViewHandle | null>(
    null,
  );
  /** Bump after tree/host mutations so canUndo/canRedo/readHistory recompute. */
  const [historyTick, setHistoryTick] = createSignal(0);
  const [bootstrapCopied, setBootstrapCopied] = createSignal(false);

  const bumpHistory = () => setHistoryTick((n) => n + 1);

  const copyBootstrap = async () => {
    try {
      await navigator.clipboard.writeText(SOLID_BOOTSTRAP);
      setBootstrapCopied(true);
      window.setTimeout(() => setBootstrapCopied(false), 1600);
    } catch {
      /* ignore clipboard errors in non-secure contexts */
    }
  };

  const validity = createMemo(() => parseJsonSource(source()));

  const canUndo = createMemo(() => {
    historyTick();
    return treeHandle()?.callCommand('canUndo') === true;
  });

  const canRedo = createMemo(() => {
    historyTick();
    return treeHandle()?.callCommand('canRedo') === true;
  });

  const historySnap = createMemo((): HistoryReadSnapshot | null => {
    historyTick();
    const handle = treeHandle();
    if (!handle) return null;
    // Avoid callCommand<T>() in TSX (parsed as JSX); assert instead.
    return (
      (handle.callCommand('readHistory') as HistoryReadSnapshot | undefined) ??
      null
    );
  });

  /**
   * Undo stack newest-first (index 0 = next Undo target).
   * `readHistory.entries` is oldest→newest; reverse for display.
   */
  const undoEntriesNewestFirst = createMemo((): HistoryEntryMeta[] => {
    const entries = historySnap()?.entries ?? [];
    if (entries.length === 0) return [];
    return [...entries].reverse();
  });

  const onTreeChange = (pretty: string) => {
    setSource(pretty);
    // Runtime notifies plugins before onChange, so canUndo is already true.
    bumpHistory();
    // Belt: re-read after the full dispatch flush (re-entrant plugin txs).
    queueMicrotask(bumpHistory);
  };

  const onSourceChange = (next: string) => {
    setSource(next);
    // Host rewrite is external; history plugin clears (default policy).
    // Defer bump so the runtime processes the value prop first.
    queueMicrotask(bumpHistory);
  };

  const runUndo = () => {
    const ok = treeHandle()?.callCommand('undo');
    if (ok === true) bumpHistory();
  };

  const runRedo = () => {
    const ok = treeHandle()?.callCommand('redo');
    if (ok === true) bumpHistory();
  };

  const runClear = () => {
    treeHandle()?.callCommand('clearHistory');
    bumpHistory();
  };

  const resetSample = () => {
    setSource(STARTER_JSON);
    queueMicrotask(() => {
      treeHandle()?.callCommand('clearHistory');
      bumpHistory();
    });
  };

  return (
    <div class="app">
      <DemoHeader page="history">
        <span
          class="stat-pill"
          classList={{ 'stat-pill--muted': !canUndo() }}
          title="Tree-local undo available"
        >
          canUndo: {canUndo() ? 'yes' : 'no'}
        </span>
        <span
          class="stat-pill"
          classList={{ 'stat-pill--muted': !canRedo() }}
          title="Tree-local redo available"
        >
          canRedo: {canRedo() ? 'yes' : 'no'}
        </span>
        <span class="stat-pill stat-pill--muted" title="Undo stack depth">
          undo {historySnap()?.undoDepth ?? 0}
        </span>
        <span class="stat-pill stat-pill--muted" title="Redo stack depth">
          redo {historySnap()?.redoDepth ?? 0}
        </span>
        <button
          type="button"
          class="btn"
          disabled={!canUndo()}
          title="callCommand('undo') — path-scoped tree undo"
          onClick={runUndo}
        >
          Undo
        </button>
        <button
          type="button"
          class="btn"
          disabled={!canRedo()}
          title="callCommand('redo')"
          onClick={runRedo}
        >
          Redo
        </button>
        <button
          type="button"
          class="btn"
          disabled={
            (historySnap()?.undoDepth ?? 0) === 0 &&
            (historySnap()?.redoDepth ?? 0) === 0
          }
          title="callCommand('clearHistory')"
          onClick={runClear}
        >
          Clear history
        </button>
        <button
          type="button"
          class="btn"
          classList={{ 'btn--active': showSource() }}
          aria-pressed={showSource()}
          title="Toggle dual-pane source editor (host rewrites clear tree history)"
          onClick={() => setShowSource((v) => !v)}
        >
          {showSource() ? 'Hide source' : 'Show source'}
        </button>
        <button type="button" class="btn" onClick={resetSample}>
          Reset sample
        </button>
      </DemoHeader>

      <div
        class="panes"
        classList={{
          'panes--three': showSource(),
          'panes--two': !showSource(),
        }}
      >
        <Show when={showSource()}>
          <section class="pane" aria-label="JSON source editor">
            <div class="pane-header">
              <span>Source (host)</span>
              <span>external · clears tree history</span>
            </div>
            <div class="pane-body">
              <JsonEditor value={source()} onChange={onSourceChange} />
            </div>
          </section>
        </Show>

        <section class="pane" aria-label="JSON tree editor with history">
          <div class="pane-header">
            <span>Tree + historyPlugin</span>
            <span>edit · path-scoped undo</span>
          </div>
          <div class="pane-body">
            <JsonTreeView
              value={source()}
              onChange={onTreeChange}
              defaultExpandedDepth={2}
              plugins={HISTORY_PLUGINS}
              ref={(handle) => {
                setTreeHandle(handle);
                // Initial canUndo/canRedo after mount.
                bumpHistory();
              }}
            />
          </div>
        </section>

        <section class="pane" aria-label="History stack and notes">
          <div class="pane-header">
            <span>History stack</span>
            <span>readHistory · live</span>
          </div>
          <div class="pane-body pane-body--stack">
            <div class="large-stats history-panel" role="status">
              <div class="history-depths" aria-label="Stack depths">
                <div
                  class="history-depths__card"
                  classList={{
                    'history-depths__card--active':
                      (historySnap()?.undoDepth ?? 0) > 0,
                  }}
                >
                  <span class="history-depths__label">Undo</span>
                  <span class="history-depths__value">
                    {historySnap()?.undoDepth ?? 0}
                  </span>
                </div>
                <div
                  class="history-depths__card"
                  classList={{
                    'history-depths__card--active':
                      (historySnap()?.redoDepth ?? 0) > 0,
                  }}
                >
                  <span class="history-depths__label">Redo</span>
                  <span class="history-depths__value">
                    {historySnap()?.redoDepth ?? 0}
                  </span>
                </div>
                <div class="history-depths__card history-depths__card--meta">
                  <span class="history-depths__label">~bytes</span>
                  <span class="history-depths__value history-depths__value--sm">
                    {historySnap() != null
                      ? historySnap()!.approxBytes.toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>

              <dl class="large-stats__grid history-panel__meta">
                <dt>Backend</dt>
                <dd>{historySnap()?.backend ?? '—'}</dd>
                <dt>Scope</dt>
                <dd>path deltas (not full doc)</dd>
              </dl>

              <div class="history-stack">
                <div class="history-stack__section">
                  <strong class="history-stack__heading">
                    Undo stack
                    <span class="history-stack__heading-hint">
                      newest first · top = next Undo
                    </span>
                  </strong>
                  <Show
                    when={undoEntriesNewestFirst().length > 0}
                    fallback={
                      <p class="history-stack__empty">
                        Stack empty — edit a key, value, or type in the tree to
                        push an entry.
                      </p>
                    }
                  >
                    <ol class="history-stack__list" aria-label="Undo stack">
                      <Index each={undoEntriesNewestFirst()}>
                        {(entry, index) => (
                          <HistoryStackRow
                            entry={entry()}
                            index={index}
                            isTop={index === 0}
                            stackLabel="undo"
                          />
                        )}
                      </Index>
                    </ol>
                  </Show>
                </div>

                <div class="history-stack__section">
                  <strong class="history-stack__heading">
                    Redo stack
                    <span class="history-stack__heading-hint">
                      filled after Undo
                    </span>
                  </strong>
                  <Show
                    when={(historySnap()?.redoDepth ?? 0) > 0}
                    fallback={
                      <p class="history-stack__empty">
                        No redo entries. Undo first, then Redo to re-apply.
                      </p>
                    }
                  >
                    <p class="history-stack__redo-summary">
                      <span class="history-stack__redo-count">
                        {historySnap()!.redoDepth}
                      </span>{' '}
                      {(historySnap()!.redoDepth === 1
                        ? 'entry'
                        : 'entries') + ' '}
                      waiting — use header <strong>Redo</strong>. Meta list is
                      undo-only from <code>readHistory</code>.
                    </p>
                  </Show>
                </div>
              </div>

              <p class="large-stats__hint history-panel__policy">
                <strong>Dual-pane:</strong> tree undo is tree-local. Host source
                edits use <code>externalPolicy: &apos;clear&apos;</code> and wipe
                this stack. Source has its own CodeMirror history.
              </p>
            </div>

            <details class="bootstrap-pane" open>
              <summary class="bootstrap-pane__summary">
                <span>Bootstrap · How to wire</span>
                <span class="bootstrap-pane__api">Solid API</span>
              </summary>
              <div class="bootstrap-pane__body">
                <div class="bootstrap-pane__toolbar">
                  <button
                    type="button"
                    class="btn bootstrap-pane__copy"
                    onClick={() => void copyBootstrap()}
                  >
                    {bootstrapCopied() ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre class="bootstrap-pane__pre">
                  <code>{SOLID_BOOTSTRAP}</code>
                </pre>
              </div>
            </details>

            <div class="large-preview">
              <div
                class="pane-header"
                style={{ 'border-top': '1px solid #232833' }}
              >
                <span>Formatted</span>
                <span>live parse</span>
              </div>
              <JsonFormatted validity={validity()} />
            </div>
          </div>
        </section>
      </div>

      <footer class="status-bar" role="status" aria-live="polite">
        <ValidityStatus validity={validity()} />
        <span class="status-bar__msg">
          {validity().ok
            ? `History demo · undo ${historySnap()?.undoDepth ?? 0} · redo ${historySnap()?.redoDepth ?? 0}`
            : (validity() as { error: string }).error}
        </span>
        <span class="status-bar__meta">
          <a class="nav-link nav-link--footer" href="/">
            main demo
          </a>
          {' · '}
          /history.html
        </span>
      </footer>
    </div>
  );
};

/** Human-readable path: `name`, `meta.author`, `items.0.qty`. */
function formatPathHint(path: readonly (string | number)[]): string {
  if (path.length === 0) return 'root';
  return path.map((p) => String(p)).join('.');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const HistoryStackRow: Component<{
  entry: HistoryEntryMeta;
  index: number;
  isTop: boolean;
  stackLabel: string;
}> = (props) => {
  const path = () => formatPathHint(props.entry.pathHint);
  return (
    <li
      class="history-stack__row"
      classList={{ 'history-stack__row--top': props.isTop }}
      title={
        props.isTop
          ? 'Next Undo target'
          : `${props.stackLabel} #${props.index + 1}`
      }
    >
      <span class="history-stack__rank" aria-hidden="true">
        {props.isTop ? '▶' : props.index + 1}
      </span>
      <div class="history-stack__body">
        <div class="history-stack__primary">
          <span class="history-stack__path" title={path()}>
            {path()}
          </span>
          <Show when={props.isTop}>
            <span class="history-stack__badge">next undo</span>
          </Show>
        </div>
        <div class="history-stack__secondary">
          <span class="history-stack__commit">{props.entry.commitKind}</span>
          <span class="history-stack__sep">·</span>
          <span class="history-stack__kind">{props.entry.kind}</span>
          <span class="history-stack__sep">·</span>
          <span class="history-stack__size">
            {formatBytes(props.entry.approxBytes)}
          </span>
        </div>
      </div>
    </li>
  );
};

const ValidityStatus: Component<{ validity: JsonValidity }> = (props) => (
  <span
    classList={{
      'status-bar__pill': true,
      'status-bar__pill--ok': props.validity.ok,
      'status-bar__pill--err': !props.validity.ok,
    }}
  >
    {props.validity.ok ? '● valid' : '● invalid'}
  </span>
);
