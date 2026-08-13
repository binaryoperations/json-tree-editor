import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from '../../json-tree-editor/src';
import {
  historyPlugin,
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
  For,
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

  const bumpHistory = () => setHistoryTick((n) => n + 1);

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

  const onTreeChange = (pretty: string) => {
    setSource(pretty);
    bumpHistory();
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
            <span>History</span>
            <span>readHistory · policy</span>
          </div>
          <div class="pane-body pane-body--stack">
            <div class="large-stats history-panel" role="status">
              <div>
                <strong>Path-scoped stack</strong>
                <p>
                  Entries store subtree deltas only — never full-document
                  copies. Commands:{' '}
                  <code>undo</code>, <code>redo</code>, <code>canUndo</code>,{' '}
                  <code>canRedo</code>, <code>readHistory</code>,{' '}
                  <code>clearHistory</code>.
                </p>
              </div>
              <dl class="large-stats__grid">
                <dt>Backend</dt>
                <dd>{historySnap()?.backend ?? '—'}</dd>
                <dt>Undo depth</dt>
                <dd>{historySnap()?.undoDepth ?? 0}</dd>
                <dt>Redo depth</dt>
                <dd>{historySnap()?.redoDepth ?? 0}</dd>
                <dt>Approx bytes</dt>
                <dd>
                  {historySnap() != null
                    ? historySnap()!.approxBytes.toLocaleString()
                    : '—'}
                </dd>
              </dl>
              <div class="history-entries">
                <strong>Recent entries (newest first)</strong>
                <Show
                  when={(historySnap()?.entries.length ?? 0) > 0}
                  fallback={
                    <p class="large-stats__hint">
                      Edit a key, value, or type in the tree to record history.
                    </p>
                  }
                >
                  <ol class="history-entries__list">
                    <For each={[...(historySnap()?.entries ?? [])].reverse()}>
                      {(entry) => (
                        <li>
                          <span class="history-entries__kind">{entry.kind}</span>
                          <span class="history-entries__meta">
                            {entry.commitKind}
                            {entry.pathHint.length
                              ? ` · ${formatPathHint(entry.pathHint)}`
                              : ''}
                          </span>
                        </li>
                      )}
                    </For>
                  </ol>
                </Show>
              </div>
              <p class="large-stats__hint">
                <strong>Dual-pane note:</strong> tree undo is tree-local. Opening
                the source pane and editing there is a host whole-document write
                (<code>externalPolicy: &apos;clear&apos;</code> by default) —
                tree history is wiped. Source has its own CodeMirror history.
              </p>
            </div>
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

function formatPathHint(path: readonly (string | number)[]): string {
  if (path.length === 0) return 'root';
  return path
    .map((p) => (typeof p === 'number' ? `[${p}]` : String(p)))
    .join('.');
}

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
