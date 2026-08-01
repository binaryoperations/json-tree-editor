import {
  JsonTreeView,
  parseJsonSource,
  type JsonValidity,
} from 'json-tree-editor';
import { type Component, createMemo, createSignal, Show } from 'solid-js';

import { JsonEditor } from './components/JsonEditor';
import { JsonFormatted } from './components/JsonFormatted';
import {
  countJsonNodes,
  generateLargeJson,
  stringifyGenerated,
} from './lib/generate-large-json';

const TARGET_NODES = 5000;
const SEED = 42;

/**
 * Large-tree stress demo.
 *
 * Default layout: **Tree + stats / formatted preview** (no CodeMirror).
 * A full pretty-print of ~5k nodes is fine as an in-memory string, but mounting
 * CodeMirror on that document is expensive — enable it explicitly.
 */
export const LargeApp: Component = () => {
  const generated = generateLargeJson({
    targetNodes: TARGET_NODES,
    seed: SEED,
  });
  const initialSource = stringifyGenerated(generated.value);

  const [source, setSource] = createSignal(initialSource);
  const [showSourceEditor, setShowSourceEditor] = createSignal(false);
  const [genInfo] = createSignal({
    nodeCount: generated.nodeCount,
    generationMs: generated.generationMs,
    seed: generated.seed,
    targetNodes: generated.targetNodes,
    sourceChars: initialSource.length,
  });

  const validity = createMemo(() => parseJsonSource(source()));

  const liveNodeCount = createMemo(() => {
    const v = validity();
    if (!v.ok) return null;
    return countJsonNodes(v.value);
  });

  const onTreeChange = (pretty: string) => {
    setSource(pretty);
  };

  const regenerate = () => {
    const next = generateLargeJson({
      targetNodes: TARGET_NODES,
      seed: SEED,
    });
    setSource(stringifyGenerated(next.value));
  };

  return (
    <div class="app">
      <header class="app-header">
        <div class="app-header__left">
          <h1>json-tree-editor</h1>
          <span class="badge">large tree</span>
          <a class="nav-link" href="/">
            ← main demo
          </a>
        </div>
        <div class="app-header__right">
          <span class="stat-pill" title="Nodes = every JSON value (containers + leaves)">
            {liveNodeCount() ?? '—'} nodes
          </span>
          <span class="stat-pill stat-pill--muted">
            gen {genInfo().generationMs} ms · seed {genInfo().seed}
          </span>
          <span class="stat-pill stat-pill--muted">
            target {genInfo().targetNodes}
          </span>
          <ValidityBadge validity={validity()} />
          <button
            type="button"
            class="btn"
            onClick={regenerate}
            title="Regenerate the same seeded document"
          >
            Regenerate
          </button>
          <button
            type="button"
            class="btn"
            classList={{ 'btn--active': showSourceEditor() }}
            onClick={() => setShowSourceEditor((v) => !v)}
            title="CodeMirror on a ~5k-node pretty document can be slow to mount"
          >
            {showSourceEditor() ? 'Hide source editor' : 'Load source editor'}
          </button>
        </div>
      </header>

      <div
        class="panes"
        classList={{
          'panes--three': showSourceEditor(),
          'panes--two': !showSourceEditor(),
        }}
      >
        <Show when={showSourceEditor()}>
          <section class="pane" aria-label="JSON source editor">
            <div class="pane-header">
              <span>Source</span>
              <span>CodeMirror · may be slow at this size</span>
            </div>
            <div class="pane-body">
              <JsonEditor value={source()} onChange={setSource} />
            </div>
          </section>
        </Show>

        <section class="pane" aria-label="JSON tree editor">
          <div class="pane-header">
            <span>Tree</span>
            <span>root expanded · expand children as needed</span>
          </div>
          <div class="pane-body">
            <JsonTreeView validity={validity()} onChange={onTreeChange} />
          </div>
        </section>

        <section class="pane" aria-label="Stats and formatted preview">
          <div class="pane-header">
            <span>Preview</span>
            <span>read-only · live parse</span>
          </div>
          <div class="pane-body pane-body--stack">
            <div class="large-stats" role="status">
              <div>
                <strong>Node count method</strong>
                <p>
                  Every JSON value is one node (object, array, or primitive).
                  Nested values sum under their parent.
                </p>
              </div>
              <dl class="large-stats__grid">
                <dt>Initial nodes</dt>
                <dd>{genInfo().nodeCount}</dd>
                <dt>Live nodes</dt>
                <dd>{liveNodeCount() ?? 'invalid'}</dd>
                <dt>Generation</dt>
                <dd>{genInfo().generationMs} ms</dd>
                <dt>Seed</dt>
                <dd>{genInfo().seed}</dd>
                <dt>Source size</dt>
                <dd>{source().length.toLocaleString()} chars</dd>
                <dt>Departments</dt>
                <dd>
                  {validity().ok
                    ? String(
                        (
                          (validity() as Extract<JsonValidity, { ok: true }>)
                            .value as { departments?: unknown[] }
                        ).departments?.length ?? '—',
                      )
                    : '—'}
                </dd>
              </dl>
              <p class="large-stats__hint">
                Expand-all is intentionally omitted (can freeze). Edit primitives
                and expand branches to stress reconciliation.
              </p>
            </div>
            <div class="large-preview">
              <JsonFormatted validity={validity()} />
            </div>
          </div>
        </section>
      </div>

      <footer class="status-bar" role="status" aria-live="polite">
        <span
          classList={{
            'status-bar__pill': true,
            'status-bar__pill--ok': validity().ok,
            'status-bar__pill--err': !validity().ok,
          }}
        >
          {validity().ok ? '● valid' : '● invalid'}
        </span>
        <span class="status-bar__msg">
          {validity().ok
            ? `Stress demo · ~${liveNodeCount()} nodes · tree editable`
            : validity().error}
        </span>
        <span class="status-bar__meta">
          <a class="nav-link nav-link--footer" href="/">
            main demo
          </a>
          {' · '}
          /large.html
        </span>
      </footer>
    </div>
  );
};

const ValidityBadge: Component<{ validity: JsonValidity }> = (props) => (
  <span
    classList={{
      'validity-badge': true,
      'validity-badge--ok': props.validity.ok,
      'validity-badge--err': !props.validity.ok,
    }}
    title={props.validity.ok ? 'Valid JSON' : props.validity.error}
  >
    {props.validity.ok ? 'Valid JSON' : 'Invalid JSON'}
  </span>
);
