/**
 * Web Component entry: `<json-tree-editor>`.
 *
 * Solid is bundled into this build so React / Svelte / Vue / vanilla hosts do
 * not need solid-js. Import once:
 *
 *   import '@binaryoperations/json-tree-editor/web-component';
 *
 * API:
 *   - property `value` (string) — preferred source of truth (esp. large JSON)
 *   - attribute `value` — optional; reflected only for small values
 *   - property/attribute `default-expanded-depth` / `defaultExpandedDepth`
 *     (number, default `0` = root open only)
 *   - property/attribute `readOnly` / `readonly` — browseable read-only tree
 *   - property/attribute `array-reorder` / `arrayReorder` — array drag-and-drop
 *     (boolean, default `true`)
 *   - property/attribute `search` — in-tree find (default `true`).
 *     Set `false` / `search="false"` to disable
 *   - property `plugins` / method `use(plugin)` — document plugins (no HTML attrs)
 *   - methods `callCommand` / `hasCommand` / `getRoot`
 *   - events `change` / `json-change` — detail: `{ value: string }`
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';

import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from './components/primitives/JsonTreeView';
import { HTML5_ARRAY_REORDER } from './dnd';
import type { JsonTreeEditorPlugin } from './lib/editor-runtime/types';
import styles from './styles.css?inline';

const TAG = 'json-tree-editor';
/** Avoid reflecting multi-megabyte JSON into the live DOM attribute tree. */
const MAX_REFLECT_ATTR_CHARS = 8_192;

export type JsonTreeEditorChangeDetail = {
  value: string;
};

export type JsonTreeEditorElement = InstanceType<typeof JsonTreeEditor>;

type HostBridge = {
  setValue: (next: string) => void;
  setReadOnly: (next: boolean) => void;
  setArrayReorder: (next: boolean) => void;
  setSearch: (next: boolean) => void;
  setPlugins: (next: JsonTreeEditorPlugin[]) => void;
  use: (plugin: JsonTreeEditorPlugin) => () => void;
  callCommand: <T = unknown>(name: string, ...args: unknown[]) => T | undefined;
  hasCommand: (name: string) => boolean;
  getRoot: () => HTMLDivElement | null;
};

function parseDepth(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

class JsonTreeEditor extends HTMLElement {
  static get observedAttributes(): string[] {
    return [
      'value',
      'readonly',
      'default-expanded-depth',
      'array-reorder',
      'search',
    ];
  }

  #value = '';
  #readOnly = false;
  #defaultExpandedDepth = 0;
  /** Array drag-and-drop; default on for the WC surface. */
  #arrayReorder = true;
  /** In-tree search (Cmd/Ctrl+F); default on. */
  #search = true;
  /** Plugin list property (not reflected as HTML attributes). */
  #plugins: JsonTreeEditorPlugin[] = [];
  /**
   * `use(plugin)` calls made before the Solid bridge is ready.
   * Each entry stores the plugin + a shared dispose slot filled after mount.
   */
  #queuedUses: Array<{
    plugin: JsonTreeEditorPlugin;
    dispose: (() => void) | null;
  }> = [];
  /** Disposers for plugins registered via `use()` after (or flushed at) mount. */
  #useDisposers = new Set<() => void>();
  #mounted = false;
  #bridge: HostBridge | null = null;
  #dispose: (() => void) | null = null;
  /** Suppress attribute→property feedback while we write our own attrs. */
  #reflecting = false;

  get value(): string {
    return this.#value;
  }

  set value(next: string) {
    const str = next == null ? '' : String(next);
    if (str === this.#value) return;
    this.#value = str;
    this.#bridge?.setValue(str);
    this.#syncValueAttribute(str);
  }

  get readOnly(): boolean {
    return this.#readOnly;
  }

  set readOnly(next: boolean) {
    const flag = Boolean(next);
    if (flag === this.#readOnly) return;
    this.#readOnly = flag;
    this.#bridge?.setReadOnly(flag);
    this.#reflecting = true;
    if (flag) this.setAttribute('readonly', '');
    else this.removeAttribute('readonly');
    this.#reflecting = false;
  }

  /**
   * Nesting levels open on mount (`0` = root only).
   * Applied when the tree mounts; later changes do not reset live expand state.
   */
  get defaultExpandedDepth(): number {
    return this.#defaultExpandedDepth;
  }

  set defaultExpandedDepth(next: number) {
    const d = parseDepth(next);
    if (d === this.#defaultExpandedDepth) return;
    this.#defaultExpandedDepth = d;
    this.#syncDefaultExpandedDepthAttribute(d);
  }

  /**
   * Enable HTML5 array drag-and-drop (default `true` for the web component).
   * Reflects as the boolean attribute `array-reorder`.
   */
  get arrayReorder(): boolean {
    return this.#arrayReorder;
  }

  set arrayReorder(next: boolean) {
    const flag = Boolean(next);
    if (flag === this.#arrayReorder) return;
    this.#arrayReorder = flag;
    this.#bridge?.setArrayReorder(flag);
    this.#syncArrayReorderAttribute(flag);
  }

  /**
   * In-tree search / find (default `true`). Reflects as attribute `search`.
   * Set `false` or `search="false"` to disable Cmd/Ctrl+F.
   */
  get search(): boolean {
    return this.#search;
  }

  set search(next: boolean) {
    const flag = Boolean(next);
    if (flag === this.#search) return;
    this.#search = flag;
    this.#bridge?.setSearch(flag);
    this.#syncSearchAttribute(flag);
  }

  /** The tree root element (`.json-tree` in shadow DOM), or `null` if unmounted. */
  getRoot(): HTMLDivElement | null {
    return this.#bridge?.getRoot() ?? null;
  }

  /**
   * Document plugins (history, collab, …). Property only — no HTML attribute.
   * Replaces the previous list by plugin `name` (same identity rules as Solid).
   */
  get plugins(): JsonTreeEditorPlugin[] {
    return this.#plugins;
  }

  set plugins(next: JsonTreeEditorPlugin[] | null | undefined) {
    const list = Array.isArray(next) ? next : [];
    this.#plugins = list;
    this.#bridge?.setPlugins(list);
  }

  /**
   * Register a plugin. Queues until connected; returns a dispose function.
   * After disconnect, disposed plugins are not auto-revived — re-register.
   */
  use(plugin: JsonTreeEditorPlugin): () => void {
    if (this.#bridge) {
      const dispose = this.#bridge.use(plugin);
      this.#useDisposers.add(dispose);
      return () => {
        dispose();
        this.#useDisposers.delete(dispose);
      };
    }
    const entry: {
      plugin: JsonTreeEditorPlugin;
      dispose: (() => void) | null;
    } = { plugin, dispose: null };
    this.#queuedUses.push(entry);
    return () => {
      if (entry.dispose) {
        entry.dispose();
        this.#useDisposers.delete(entry.dispose);
        entry.dispose = null;
        return;
      }
      // Still queued — drop before mount.
      this.#queuedUses = this.#queuedUses.filter((e) => e !== entry);
    };
  }

  callCommand<T = unknown>(name: string, ...args: unknown[]): T | undefined {
    return this.#bridge?.callCommand<T>(name, ...args);
  }

  hasCommand(name: string): boolean {
    return this.#bridge?.hasCommand(name) ?? false;
  }

  connectedCallback(): void {
    if (this.#mounted) return;
    this.#mounted = true;

    // Prefer property if already set; else seed from attribute.
    if (!this.#value) {
      const attr = this.getAttribute('value');
      if (attr != null) this.#value = attr;
    }
    this.#readOnly = this.hasAttribute('readonly');
    // Presence of attribute with value "false" disables; missing attribute keeps default true.
    if (this.hasAttribute('array-reorder')) {
      this.#arrayReorder = this.getAttribute('array-reorder') !== 'false';
    }
    if (this.hasAttribute('search')) {
      this.#search = this.getAttribute('search') !== 'false';
    }

    if (this.hasAttribute('default-expanded-depth')) {
      this.#defaultExpandedDepth = parseDepth(
        this.getAttribute('default-expanded-depth'),
      );
    }

    const shadow =
      this.shadowRoot ?? this.attachShadow({ mode: 'open' });

    let styleEl = shadow.querySelector('style[data-jte]');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-jte', '');
      styleEl.textContent = styles;
      shadow.appendChild(styleEl);
    }

    let mount = shadow.querySelector<HTMLDivElement>('[data-jte-root]');
    if (!mount) {
      mount = document.createElement('div');
      mount.setAttribute('data-jte-root', '');
      mount.style.display = 'contents';
      shadow.appendChild(mount);
    } else {
      mount.replaceChildren();
    }

    const host = this;
    const initialValue = this.#value;
    const initialReadOnly = this.#readOnly;
    const initialDepth = this.#defaultExpandedDepth;
    const initialArrayReorder = this.#arrayReorder;
    const initialSearch = this.#search;
    const initialPlugins = this.#plugins;

    this.#dispose = render(() => {
      const [value, setValue] = createSignal(initialValue);
      const [readOnly, setReadOnly] = createSignal(initialReadOnly);
      const [arrayReorder, setArrayReorder] = createSignal(initialArrayReorder);
      const [search, setSearch] = createSignal(initialSearch);
      const [plugins, setPlugins] = createSignal<JsonTreeEditorPlugin[]>(
        initialPlugins,
      );
      let treeHandle: JsonTreeViewHandle | undefined;

      host.#bridge = {
        setValue: (next) => setValue(next),
        setReadOnly: (next) => setReadOnly(next),
        setArrayReorder: (next) => setArrayReorder(next),
        setSearch: (next) => setSearch(next),
        setPlugins: (next) => setPlugins(next),
        use: (plugin) => {
          if (!treeHandle) {
            // Same-frame mount race: queue like pre-connect `use()`.
            const entry: {
              plugin: JsonTreeEditorPlugin;
              dispose: (() => void) | null;
            } = { plugin, dispose: null };
            host.#queuedUses.push(entry);
            return () => {
              if (entry.dispose) {
                entry.dispose();
                host.#useDisposers.delete(entry.dispose);
                entry.dispose = null;
              }
              host.#queuedUses = host.#queuedUses.filter((e) => e !== entry);
            };
          }
          const dispose = treeHandle.use(plugin);
          host.#useDisposers.add(dispose);
          return () => {
            dispose();
            host.#useDisposers.delete(dispose);
          };
        },
        callCommand: (name, ...args) => treeHandle?.callCommand(name, ...args),
        hasCommand: (name) => treeHandle?.hasCommand(name) ?? false,
        getRoot: () => treeHandle?.getRoot() ?? null,
      };

      const onChange = (pretty: string) => {
        if (readOnly()) return;
        if (pretty === host.#value) return;
        host.#value = pretty;
        setValue(pretty);
        host.#syncValueAttribute(pretty);
        host.#emitChange(pretty);
      };

      return (
        <div
          style={{
            height: '100%',
            width: '100%',
          }}
        >
          <JsonTreeView
            ref={(h) => {
              treeHandle = h;
              // Flush pre-connect use() queue once the handle exists.
              host.#flushQueuedUses(h);
            }}
            value={value()}
            onChange={onChange}
            defaultExpandedDepth={initialDepth}
            readOnly={readOnly()}
            search={search()}
            arrayReorder={arrayReorder() ? HTML5_ARRAY_REORDER : false}
            plugins={plugins()}
          />
        </div>
      );
    }, mount);
  }

  disconnectedCallback(): void {
    // Dispose use()-registered plugins first (Solid unmount also tears down
    // plugins prop installs via runtime.dispose).
    for (const dispose of this.#useDisposers) {
      try {
        dispose();
      } catch {
        /* isolate */
      }
    }
    this.#useDisposers.clear();
    this.#queuedUses = [];

    this.#dispose?.();
    this.#dispose = null;
    this.#bridge = null;
    this.#mounted = false;
  }

  #flushQueuedUses(handle: JsonTreeViewHandle): void {
    if (this.#queuedUses.length === 0) return;
    const queued = this.#queuedUses;
    this.#queuedUses = [];
    for (const entry of queued) {
      const dispose = handle.use(entry.plugin);
      entry.dispose = dispose;
      this.#useDisposers.add(dispose);
    }
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    next: string | null,
  ): void {
    if (this.#reflecting) return;
    if (name === 'value') {
      const str = next ?? '';
      if (str === this.#value) return;
      this.#value = str;
      this.#bridge?.setValue(str);
      return;
    }
    if (name === 'readonly') {
      const flag = next != null;
      if (flag === this.#readOnly) return;
      this.#readOnly = flag;
      this.#bridge?.setReadOnly(flag);
      return;
    }
    if (name === 'array-reorder') {
      // Reflect boolean attributes: present + not "false" → true.
      const flag = next != null && next !== 'false';
      if (flag === this.#arrayReorder) return;
      this.#arrayReorder = flag;
      this.#bridge?.setArrayReorder(flag);
      return;
    }
    if (name === 'search') {
      // Missing attribute → leave property as-is (connected seeds default true).
      // Present + not "false" → true; "false" → false.
      if (next == null) return;
      const flag = next !== 'false';
      if (flag === this.#search) return;
      this.#search = flag;
      this.#bridge?.setSearch(flag);
      return;
    }
    if (name === 'default-expanded-depth') {
      this.#defaultExpandedDepth = parseDepth(next);
    }
  }

  #syncValueAttribute(str: string): void {
    // Property is preferred for large documents; only reflect modest sizes.
    if (str.length > MAX_REFLECT_ATTR_CHARS) {
      if (this.hasAttribute('value')) {
        this.#reflecting = true;
        this.removeAttribute('value');
        this.#reflecting = false;
      }
      return;
    }
    if (this.getAttribute('value') === str) return;
    this.#reflecting = true;
    this.setAttribute('value', str);
    this.#reflecting = false;
  }

  #syncDefaultExpandedDepthAttribute(depth: number): void {
    const raw = String(depth);
    if (this.getAttribute('default-expanded-depth') === raw) return;
    this.#reflecting = true;
    this.setAttribute('default-expanded-depth', raw);
    this.#reflecting = false;
  }

  #syncArrayReorderAttribute(flag: boolean): void {
    this.#reflecting = true;
    if (flag) {
      if (this.getAttribute('array-reorder') !== '') {
        this.setAttribute('array-reorder', '');
      }
    } else if (this.hasAttribute('array-reorder')) {
      // Keep attribute so hosts can see explicit off; value "false".
      this.setAttribute('array-reorder', 'false');
    } else {
      this.setAttribute('array-reorder', 'false');
    }
    this.#reflecting = false;
  }

  #syncSearchAttribute(flag: boolean): void {
    this.#reflecting = true;
    if (flag) {
      // Default is on — drop the attribute when enabled so markup stays clean.
      if (this.hasAttribute('search')) this.removeAttribute('search');
    } else {
      this.setAttribute('search', 'false');
    }
    this.#reflecting = false;
  }

  #emitChange(value: string): void {
    const detail: JsonTreeEditorChangeDetail = { value };
    this.dispatchEvent(
      new CustomEvent('change', { detail, bubbles: true, composed: true }),
    );
    this.dispatchEvent(
      new CustomEvent('json-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
}

export function defineJsonTreeEditor(
  tag: string = TAG,
): typeof JsonTreeEditor {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, JsonTreeEditor);
  }
  return JsonTreeEditor;
}

// Auto-register on import (primary library surface for non-Solid hosts).
defineJsonTreeEditor();

export { JsonTreeEditor, TAG as JSON_TREE_EDITOR_TAG };
export default JsonTreeEditor;
