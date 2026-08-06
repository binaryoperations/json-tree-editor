import { JsonTreeView } from '../../json-tree-editor/src';
import { HTML5_ARRAY_REORDER } from '../../json-tree-editor/src/dnd';
import {
  parseJsonSource,
  type JsonValidity,
} from '../../json-tree-editor/src/utils';
import {
  type Component,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';

import { DemoHeader } from './components/DemoHeader';
import { JsonEditor } from './components/JsonEditor';
import { JsonFormatted } from './components/JsonFormatted';
import {
  appendLargeJsonNodes,
  countJsonNodes,
  generateLargeJson,
  stringifyGenerated,
} from './lib/generate-large-json';

const TARGET_NODES = 5000;
const ADD_NODES = 1000;
const SEED = 42;

/**
 * Large-tree stress demo.
 *
 * Default layout: **Tree + stats / formatted preview** (no CodeMirror).
 * Use per-container expand / collapse on the tree toolbar to open branches.
 */
export const LargeApp: Component = () => {
  const generated = generateLargeJson({
    targetNodes: TARGET_NODES,
    seed: SEED,
  });
  const initialSource = stringifyGenerated(generated.value);

  const [source, setSource] = createSignal(initialSource);
  const [showSourceEditor, setShowSourceEditor] = createSignal(false);
  const [arrayDnd, setArrayDnd] = createSignal(true);
  const [treeReadOnly, setTreeReadOnly] = createSignal(false);
  const [fps, setFps] = createSignal(0);
  /** How many “add more” batches have been appended after the initial doc. */
  const [batchIndex, setBatchIndex] = createSignal(0);
  const [lastAppendMs, setLastAppendMs] = createSignal<number | null>(null);
  const [genInfo] = createSignal({
    nodeCount: generated.nodeCount,
    generationMs: generated.generationMs,
    seed: generated.seed,
    targetNodes: generated.targetNodes,
    sourceChars: initialSource.length,
  });

  onMount(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames += 1;
      const elapsed = now - last;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    onCleanup(() => cancelAnimationFrame(raf));
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

  const addMoreNodes = () => {
    const v = validity();
    if (!v.ok) return;
    const nextBatch = batchIndex();
    const result = appendLargeJsonNodes(v.value, {
      addNodes: ADD_NODES,
      seed: SEED + 1 + nextBatch,
      batchIndex: nextBatch,
    });
    setBatchIndex(nextBatch + 1);
    setLastAppendMs(result.generationMs);
    setSource(stringifyGenerated(result.value));
  };

  return (
    <div class="app">
      <DemoHeader page="large">
        <span
          class="stat-pill"
          title="Nodes = every JSON value (containers + leaves)"
        >
          {liveNodeCount() ?? '—'} nodes
        </span>
        <span
          class="stat-pill"
          classList={{ 'stat-pill--busy': fps() > 0 && fps() < 45 }}
          title="Main-thread animation frame rate (requestAnimationFrame)"
        >
          {fps() || '—'} fps
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
          classList={{ 'btn--active': arrayDnd() }}
          aria-pressed={arrayDnd()}
          title={
            arrayDnd()
              ? 'Array drag-and-drop is on'
              : 'Array drag-and-drop is off'
          }
          onClick={() => setArrayDnd((on) => !on)}
        >
          {arrayDnd() ? 'DnD: on' : 'DnD: off'}
        </button>
        <button
          type="button"
          class="btn"
          classList={{ 'btn--active': treeReadOnly() }}
          aria-pressed={treeReadOnly()}
          title={
            treeReadOnly()
              ? 'Tree is read-only (browse/expand only)'
              : 'Tree is editable'
          }
          onClick={() => setTreeReadOnly((d) => !d)}
        >
          {treeReadOnly() ? 'Read-only' : 'Editable'}
        </button>
        <button
          type="button"
          class="btn"
          onClick={addMoreNodes}
          disabled={!validity().ok}
          title={`Append ~${ADD_NODES} more nodes (new department batch)`}
        >
          Add more nodes
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
      </DemoHeader>

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
            <span>
              {treeReadOnly()
                ? 'read-only'
                : 'expand / collapse on containers'}
              {!treeReadOnly() && arrayDnd() ? ' · drag reorder' : ''}
            </span>
          </div>
          <div class="pane-body">
            <JsonTreeView
              value={source()}
              onChange={onTreeChange}
              readOnly={treeReadOnly()}
              arrayReorder={arrayDnd() ? HTML5_ARRAY_REORDER : false}
            />
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
                <dt>Frame rate</dt>
                <dd>{fps() ? `${fps()} fps` : '—'}</dd>
                <dt>Append batches</dt>
                <dd>{batchIndex()}</dd>
                <dt>Last append</dt>
                <dd>
                  {lastAppendMs() != null ? `${lastAppendMs()} ms` : '—'}
                </dd>
                <dt>Initial generation</dt>
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
                Open branches with the expand control on each container row.
                Collapse folds nested opens under that node.
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
            : (validity() as { error: string }).error}
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
