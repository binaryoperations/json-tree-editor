import { JsonTreeView, type JsonTreeViewHandle } from '../../../json-tree-editor/src';
import { breadcrumbsPlugin } from '../../../json-tree-editor/src/breadcrumbs';
import { HTML5_ARRAY_REORDER } from '../../../json-tree-editor/src/dnd';
import {
  parseJsonSource,
  type JsonValidity,
} from '../../../json-tree-editor/src/utils';
import {
  type Component,
  createMemo,
  createSignal,
  For,
  Show,
} from 'solid-js';

import { DemoHeader } from './DemoHeader';
import { JsonFormatted } from './JsonFormatted';

/** Stable plugin instance — identity is by object across re-renders. */
const BREADCRUMB_PLUGINS = [breadcrumbsPlugin()];
/** Empty list unregisters the plugin (and with it, `selectPath`). */
const NO_PLUGINS: typeof BREADCRUMB_PLUGINS = [];

/**
 * Deep enough that jumping to a path has to expand ancestors and scroll —
 * which is the whole point of the demo.
 */
const STARTER_JSON = `{
  "id": "crumb_01",
  "name": "Breadcrumbs demo",
  "meta": {
    "author": {
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "links": {
        "site": "https://example.com",
        "handle": "@ada"
      }
    },
    "version": 3
  },
  "items": [
    { "sku": "A-100", "qty": 2, "tags": ["blue", "small"] },
    { "sku": "B-200", "qty": 1, "tags": ["red"] },
    { "sku": "C-300", "qty": 7, "tags": ["green", "large", "clearance"] }
  ],
  "settings": {
    "flags": { "beta": true, "verbose": false },
    "limits": { "retries": 3, "timeoutMs": 2500 }
  }
}
`;

/** Paths the "Jump to" buttons address, deepest-first. */
const JUMP_TARGETS: { label: string; path: (string | number)[] }[] = [
  { label: 'meta.author.links.handle', path: ['meta', 'author', 'links', 'handle'] },
  { label: 'items[2].tags[2]', path: ['items', 2, 'tags', 2] },
  { label: 'settings.limits.timeoutMs', path: ['settings', 'limits', 'timeoutMs'] },
  { label: 'items[0].sku', path: ['items', 0, 'sku'] },
];

const SOLID_BOOTSTRAP = `import { JsonTreeView } from '@binaryoperations/json-tree-editor';
import { breadcrumbsPlugin } from '@binaryoperations/json-tree-editor/breadcrumbs';
import '@binaryoperations/json-tree-editor/styles.css';

// Stable instance — the plugin owns the bar's state.
const plugins = [
  breadcrumbsPlugin({
    stage: 'head', // 'head' (above the tree) | 'tail' (below it)
    flash: true,   // ring the key after the scroll lands
    focus: true,   // move DOM focus to the revealed row
  }),
];

export function Editor() {
  const [json, setJson] = createSignal('{"meta":{"author":{"name":"Ada"}}}');
  let handle;

  return (
    <>
      <button onClick={() => handle.callCommand('selectPath', ['meta','author','name'])}>
        Jump to meta.author.name
      </button>

      {/* The bar is rendered by the plugin — no extra markup here. */}
      <JsonTreeView
        value={json()}
        onChange={setJson}
        plugins={plugins}
        ref={(h) => (handle = h)}
      />
    </>
  );
}
`;

const WC_BOOTSTRAP = `<script type="module">
  import '@binaryoperations/json-tree-editor/web-component';
  import { breadcrumbsPlugin } from '@binaryoperations/json-tree-editor/breadcrumbs';

  const tree = document.querySelector('json-tree-editor');
  tree.value = '{"meta":{"author":{"name":"Ada"}}}';

  // Same plugin object a Solid host uses — the bar renders in the shadow root.
  tree.plugins = [breadcrumbsPlugin({ stage: 'head' })];

  // selectPath is registered by the plugin, so it exists only while it is loaded.
  if (tree.hasCommand('selectPath')) {
    await tree.callCommand('selectPath', ['meta', 'author', 'name']);
    // or an RFC 6901 pointer:
    await tree.callCommand('selectPath', '/meta/author/name');
  }
</script>

<json-tree-editor></json-tree-editor>
`;

type CodeFlavor = 'solid' | 'wc';

/**
 * Breadcrumbs plugin demo.
 *
 * The bar itself is **not** demo markup — it is contributed by
 * `breadcrumbsPlugin()` through the plugin `render` hook, so toggling the
 * plugin off removes both the bar and the `selectPath` command it masters.
 */
export const BreadcrumbDemo: Component = () => {
  const [source, setSource] = createSignal(STARTER_JSON);
  const [enabled, setEnabled] = createSignal(true);
  const [flavor, setFlavor] = createSignal<CodeFlavor>('solid');
  const [treeHandle, setTreeHandle] = createSignal<JsonTreeViewHandle | null>(
    null,
  );
  const [lastJump, setLastJump] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const validity = createMemo((): JsonValidity => parseJsonSource(source()));

  const snippet = () =>
    flavor() === 'solid' ? SOLID_BOOTSTRAP : WC_BOOTSTRAP;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore clipboard errors in non-secure contexts */
    }
  };

  const jumpTo = async (label: string, path: (string | number)[]) => {
    const handle = treeHandle();
    if (!handle) return;
    const ok = await handle.callCommand<Promise<boolean>>('selectPath', path);
    setLastJump(ok === true ? `${label} — revealed` : `${label} — not found`);
  };

  return (
    <div class="app">
      <DemoHeader page="breadcrumb">
        <span
          class="stat-pill"
          classList={{ 'stat-pill--muted': !enabled() }}
          title="Whether breadcrumbsPlugin() is currently registered"
        >
          plugin: {enabled() ? 'on' : 'off'}
        </span>
        <span
          class="stat-pill stat-pill--muted"
          title="Commands are gone with the plugin — nothing else registers selectPath"
        >
          selectPath: {enabled() ? 'master' : 'unregistered'}
        </span>
        <button
          type="button"
          class="btn"
          classList={{ 'btn--active': enabled() }}
          aria-pressed={enabled()}
          title="Register / unregister breadcrumbsPlugin()"
          onClick={() => {
            setEnabled((v) => !v);
            setLastJump(null);
          }}
        >
          {enabled() ? 'Disable breadcrumbs' : 'Enable breadcrumbs'}
        </button>
        <button
          type="button"
          class="btn"
          onClick={() => {
            setSource(STARTER_JSON);
            setLastJump(null);
          }}
        >
          Reset sample
        </button>
      </DemoHeader>

      <div class="panes panes--two">
        <section class="pane" aria-label="JSON tree editor with breadcrumbs">
          <div class="pane-header">
            <span>Tree + breadcrumbsPlugin</span>
            <span>focus a row · the bar follows</span>
          </div>
          <div class="pane-body">
            <JsonTreeView
              value={source()}
              onChange={setSource}
              defaultExpandedDepth={1}
              arrayReorder={HTML5_ARRAY_REORDER}
              plugins={enabled() ? BREADCRUMB_PLUGINS : NO_PLUGINS}
              ref={setTreeHandle}
            />
          </div>
        </section>

        <section class="pane" aria-label="Breadcrumb controls and usage">
          <div class="pane-header">
            <span>selectPath</span>
            <span>expand · scroll · flash</span>
          </div>
          <div class="pane-body pane-body--stack">
            <div class="large-stats" role="group" aria-label="Jump to a path">
              <p class="large-stats__hint">
                Every crumb except the last is a button. Clicking one — or a
                jump below — expands ancestors, scrolls the row into view, then
                flashes a ring around its key. It never edits the document.
              </p>
              <div class="crumb-jumps">
                <For each={JUMP_TARGETS}>
                  {(target) => (
                    <button
                      type="button"
                      class="btn"
                      disabled={!enabled()}
                      title={
                        enabled()
                          ? `callCommand('selectPath', ${JSON.stringify(target.path)})`
                          : 'Enable the plugin to register selectPath'
                      }
                      onClick={() => void jumpTo(target.label, target.path)}
                    >
                      {target.label}
                    </button>
                  )}
                </For>
              </div>
              <Show
                when={lastJump()}
                fallback={
                  <p class="large-stats__hint">
                    <Show
                      when={enabled()}
                      fallback={
                        <>
                          Plugin off — <code>selectPath</code> is unregistered
                          and the bar is gone. It is a plugin command, not a
                          built-in.
                        </>
                      }
                    >
                      No jump yet.
                    </Show>
                  </p>
                }
              >
                {(msg) => <p class="large-stats__hint">Last: {msg()}</p>}
              </Show>
            </div>

            <details class="bootstrap-pane" open>
              <summary class="bootstrap-pane__summary">
                <span>Bootstrap · How to wire</span>
                <span class="bootstrap-pane__api">
                  {flavor() === 'solid' ? 'Solid API' : 'Web component API'}
                </span>
              </summary>
              <div class="bootstrap-pane__body">
                <div class="bootstrap-pane__toolbar">
                  <div class="code-flavor" role="group" aria-label="Code flavor">
                    <button
                      type="button"
                      class="btn"
                      classList={{ 'btn--active': flavor() === 'solid' }}
                      aria-pressed={flavor() === 'solid'}
                      onClick={() => setFlavor('solid')}
                    >
                      Solid
                    </button>
                    <button
                      type="button"
                      class="btn"
                      classList={{ 'btn--active': flavor() === 'wc' }}
                      aria-pressed={flavor() === 'wc'}
                      onClick={() => setFlavor('wc')}
                    >
                      Web component
                    </button>
                  </div>
                  <button
                    type="button"
                    class="btn bootstrap-pane__copy"
                    onClick={() => void copySnippet()}
                  >
                    {copied() ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre class="bootstrap-pane__pre">
                  <code>{snippet()}</code>
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
            ? `Breadcrumbs demo · plugin ${enabled() ? 'on' : 'off'}`
            : (validity() as { error: string }).error}
        </span>
        <span class="status-bar__meta">
          <a class="nav-link nav-link--footer" href="/">
            main demo
          </a>
          {' · '}
          /breadcrumb.html
        </span>
      </footer>
    </div>
  );
};
