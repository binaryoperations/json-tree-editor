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
 *   - property/attribute `disabled` — blocks pointer edits; expandAll/collapseAll still work
 *   - methods `expandAll()`, `collapseAll()`, `getRoot()`, getter `isExpanding`
 *   - events `change` / `json-change` — detail: `{ value: string }`
 *   - events `expand` / `collapse` — detail: `{ expanded: string[] }` (once each)
 *   - event `expand-progress` — detail: `{ done, total } | null`
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';

import {
  JsonTreeView,
  type ExpandProgress,
  type JsonTreeViewHandle,
} from './components/primitives/JsonTreeView';
import { HTML5_ARRAY_REORDER } from './dnd';
import styles from './styles.css?inline';

const TAG = 'json-tree-editor';
/** Avoid reflecting multi-megabyte JSON into the live DOM attribute tree. */
const MAX_REFLECT_ATTR_CHARS = 8_192;

export type JsonTreeEditorChangeDetail = {
  value: string;
};

export type JsonTreeEditorExpandDetail = {
  expanded: string[];
};

export type JsonTreeEditorExpandProgressDetail = ExpandProgress | null;

export type JsonTreeEditorElement = InstanceType<typeof JsonTreeEditor>;

type HostBridge = {
  setValue: (next: string) => void;
  setDisabled: (next: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isExpanding: () => boolean;
  getRoot: () => HTMLDivElement | null;
};

function parseDepth(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

class JsonTreeEditor extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['value', 'disabled', 'default-expanded-depth'];
  }

  #value = '';
  #disabled = false;
  #defaultExpandedDepth = 0;
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

  get disabled(): boolean {
    return this.#disabled;
  }

  set disabled(next: boolean) {
    const flag = Boolean(next);
    if (flag === this.#disabled) return;
    this.#disabled = flag;
    this.#bridge?.setDisabled(flag);
    this.#reflecting = true;
    if (flag) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
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

  /** Expand every object/array (chunked). Works even when `disabled`. */
  expandAll(): void {
    this.#bridge?.expandAll();
  }

  /** Collapse to root only. Works even when `disabled`. */
  collapseAll(): void {
    this.#bridge?.collapseAll();
  }

  get isExpanding(): boolean {
    return this.#bridge?.isExpanding() ?? false;
  }

  /** The tree root element (`.json-tree` in shadow DOM), or `null` if unmounted. */
  getRoot(): HTMLDivElement | null {
    return this.#bridge?.getRoot() ?? null;
  }

  connectedCallback(): void {
    if (this.#mounted) return;
    this.#mounted = true;

    // Prefer property if already set; else seed from attribute.
    if (!this.#value) {
      const attr = this.getAttribute('value');
      if (attr != null) this.#value = attr;
    }
    this.#disabled = this.hasAttribute('disabled');

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
    const initialDisabled = this.#disabled;
    const initialDepth = this.#defaultExpandedDepth;

    this.#dispose = render(() => {
      const [value, setValue] = createSignal(initialValue);
      const [disabled, setDisabled] = createSignal(initialDisabled);
      let treeHandle: JsonTreeViewHandle | undefined;

      host.#bridge = {
        setValue: (next) => setValue(next),
        setDisabled: (next) => setDisabled(next),
        expandAll: () => treeHandle?.expandAll(),
        collapseAll: () => treeHandle?.collapseAll(),
        isExpanding: () => treeHandle?.isExpanding() ?? false,
        getRoot: () => treeHandle?.getRoot() ?? null,
      };

      const onChange = (pretty: string) => {
        if (disabled()) return;
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
            'pointer-events': disabled() ? 'none' : undefined,
            opacity: disabled() ? '0.6' : undefined,
          }}
          aria-disabled={disabled() ? 'true' : undefined}
        >
          <JsonTreeView
            ref={(h) => {
              treeHandle = h;
            }}
            value={value()}
            onChange={onChange}
            defaultExpandedDepth={initialDepth}
            arrayReorder={HTML5_ARRAY_REORDER}
            onExpand={(keys) => {
              host.#emitExpand([...keys]);
            }}
            onExpandProgress={(p) => {
              host.#emitExpandProgress(p);
            }}
            onCollapse={(keys) => {
              host.#emitCollapse([...keys]);
            }}
          />
        </div>
      );
    }, mount);
  }

  disconnectedCallback(): void {
    this.#dispose?.();
    this.#dispose = null;
    this.#bridge = null;
    this.#mounted = false;
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
    if (name === 'disabled') {
      const flag = next != null;
      if (flag === this.#disabled) return;
      this.#disabled = flag;
      this.#bridge?.setDisabled(flag);
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

  #emitExpand(expanded: string[]): void {
    const detail: JsonTreeEditorExpandDetail = { expanded };
    this.dispatchEvent(
      new CustomEvent('expand', { detail, bubbles: true, composed: true }),
    );
  }

  #emitCollapse(expanded: string[]): void {
    const detail: JsonTreeEditorExpandDetail = { expanded };
    this.dispatchEvent(
      new CustomEvent('collapse', { detail, bubbles: true, composed: true }),
    );
  }

  #emitExpandProgress(progress: ExpandProgress | null): void {
    const detail: JsonTreeEditorExpandProgressDetail = progress;
    this.dispatchEvent(
      new CustomEvent('expand-progress', {
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
