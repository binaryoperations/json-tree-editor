# @binaryoperations/json-tree-editor

Interactive **JSON tree editor** you can drop into any app: edit keys, types, and primitives in a collapsible tree while treating a JSON **string** as the single source of truth.

Use it as a **SolidJS component** (TypeScript source, peer `solid-js`) or as a framework-agnostic **web component** (`<json-tree-editor>` with Solid bundled).

## Install

```bash
npm install @binaryoperations/json-tree-editor
# or: pnpm add @binaryoperations/json-tree-editor
# or: yarn add @binaryoperations/json-tree-editor
```

Solid apps also need `solid-js` and a Solid toolchain (for example `vite-plugin-solid`):

```bash
npm install solid-js
```

### Package entry points

| Import | What you get |
| --- | --- |
| `@binaryoperations/json-tree-editor` | Solid components + helpers (TypeScript source; peer `solid-js`) |
| `@binaryoperations/json-tree-editor/web-component` | Prebuilt `<json-tree-editor>` custom element (Solid bundled) |
| `@binaryoperations/json-tree-editor/styles.css` | Styles for the Solid path (WC embeds styles in shadow DOM) |

---

## Web component usage

Import the web component once. Solid is bundled, so React, Vue, Svelte, and vanilla hosts do not need `solid-js`.

<details>
<summary>Vanilla HTML / JavaScript example</summary>

```html
<script type="module">
  import '@binaryoperations/json-tree-editor/web-component';

  const el = document.querySelector('json-tree-editor');
  el.value = JSON.stringify({ hello: 'world', count: 1 }, null, 2);

  el.addEventListener('change', (e) => {
    console.log(e.detail.value); // pretty JSON string
  });
  // Alias with the same payload:
  // el.addEventListener('json-change', (e) => { ... });
</script>

<json-tree-editor></json-tree-editor>
```

Small documents can use the attribute instead of the property:

```html
<json-tree-editor value='{"a":1}'></json-tree-editor>
```

</details>

<details>
<summary>TypeScript host example (property + events)</summary>

```ts
import '@binaryoperations/json-tree-editor/web-component';
import type { JsonTreeEditorElement } from '@binaryoperations/json-tree-editor/web-component';

const el = document.querySelector('json-tree-editor') as JsonTreeEditorElement;
el.value = '{"name":"Ada"}';

el.addEventListener('change', (event) => {
  const { value } = (event as CustomEvent<{ value: string }>).detail;
  // Sync value back into your store / form state
  console.log(value);
});
```

</details>

### Web component API

| Surface | Type | Notes |
| --- | --- | --- |
| Property `value` | `string` | Preferred source of truth, especially for large JSON |
| Attribute `value` | `string` | Optional; reflected only when length ≤ ~8KB |
| Property / attribute `disabled` | `boolean` | Disables pointer interaction; dims the tree |
| Event `change` | `CustomEvent<{ value: string }>` | Fired after a tree edit with pretty-printed JSON |
| Event `json-change` | same as `change` | Extra alias for hosts that prefer a namespaced event |

Expand/collapse state is managed inside the component by default.

Styles live in an **open shadow DOM**. Theme tokens are defined on `:host`, so you can override them with a `style` attribute, CSS on the host element, or `::part` selectors (see [Theming](#theming)).

---

## SolidJS usage

Solid consumers import **TypeScript source** from the package root. Your bundler compiles the JSX with your app’s `solid-js` instance—no separate library JS build is required for this path.

Import styles once in your app entry or layout:

```ts
import '@binaryoperations/json-tree-editor/styles.css';
```

<details>
<summary>Solid component example</summary>

```tsx
import { createMemo, createSignal } from 'solid-js';
import {
  JsonTreeView,
  parseJsonSource,
} from '@binaryoperations/json-tree-editor';
import '@binaryoperations/json-tree-editor/styles.css';

export function JsonPanel() {
  const [source, setSource] = createSignal('{"hello":"world"}');
  const validity = createMemo(() => parseJsonSource(source()));

  return (
    <JsonTreeView
      validity={validity()}
      onChange={(prettyJson) => setSource(prettyJson)}
    />
  );
}
```

</details>

<details>
<summary>Controlled expand / collapse-all example</summary>

```tsx
import { createMemo, createSignal } from 'solid-js';
import {
  JsonTreeView,
  collectContainerPathKeys,
  defaultExpandedPaths,
  parseJsonSource,
  ROOT_PATH_KEY,
} from '@binaryoperations/json-tree-editor';

const [source, setSource] = createSignal(myJson);
const [expanded, setExpanded] = createSignal(defaultExpandedPaths());
const validity = createMemo(() => parseJsonSource(source()));

function expandAll() {
  const v = validity();
  if (!v.ok) return;
  setExpanded(new Set(collectContainerPathKeys(v.value)));
}

function collapseAll() {
  setExpanded(new Set([ROOT_PATH_KEY]));
}

<JsonTreeView
  validity={validity()}
  onChange={setSource}
  expanded={expanded()}
  onExpandedChange={setExpanded}
/>
```

</details>

### `JsonTreeView` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `validity` | `JsonValidity` | yes | Result of `parseJsonSource(source)`. Tree is interactive only when `ok: true` |
| `onChange` | `(prettyJson: string) => void` | yes | Called after an edit with pretty JSON (2-space indent + trailing newline) |
| `expanded` | `Set<string>` | no | Controlled expand path keys (`pathKey` / `ROOT_PATH_KEY`) |
| `onExpandedChange` | `(next: Set<string>) => void` | no | Fired when expand state changes |
| `defaultExpanded` | `Set<string>` | no | Uncontrolled initial expand set (default: root only). Ignored when `expanded` is set |

### Parsing

```ts
import { parseJsonSource, type JsonValidity } from '@binaryoperations/json-tree-editor';

const validity: JsonValidity = parseJsonSource(source);
// { ok: true, pretty: string, value: unknown }
// | { ok: false, error: string }
```

Keep the source string as document truth: parse for the tree, push tree edits back via `onChange`, and re-parse on the next render.

### Other Solid exports

The package root also exports path helpers (`getAtPath`, `setAtPath`, …), type utilities, and lower-level primitives (`JsonTreeNode`, editors, badges). Most apps only need `JsonTreeView` and `parseJsonSource`.

---

## Theming

Defaults match a dark editor chrome. Override CSS variables on the web component host or on `.json-tree` (Solid light DOM):

```css
json-tree-editor,
.json-tree {
  --jte-bg: #0c0e12;
  --jte-fg: #e6e8ec;
  --jte-border: #232833;
  --jte-key: #93c5fd;
  --jte-string: #86efac;
  --jte-number: #fcd34d;
  --jte-boolean: #c4b5fd;
  --jte-null: #9ca3af;
  --jte-row-hover: #151922;
  --jte-focus-ring: #60a5fa;
  --jte-font-mono: ui-monospace, Menlo, Consolas, monospace;
  --jte-font-size: 12.5px;
}
```

| Variable group | Role |
| --- | --- |
| `--jte-bg` / `--jte-fg` | Tree surface and default text |
| `--jte-border` / `--jte-border-strong` | Nesting and control borders |
| `--jte-row-hover` / `--jte-row-focus-bg` | Row chrome |
| `--jte-key` / `--jte-key-root` / `--jte-key-index` | Property keys |
| `--jte-string` / `--jte-number` / `--jte-boolean` / `--jte-null` | Primitive value colors |
| `--jte-type-*` | Type badge colors |
| `--jte-focus-ring` / `--jte-focus-border` | Focus outlines |
| `--jte-font` / `--jte-font-mono` / `--jte-font-size` | Typography |

<details>
<summary>Web component <code>::part</code> hooks</summary>

Major pieces expose `part` for styling from outside the shadow tree:

```css
json-tree-editor::part(tree) { /* .json-tree root */ }
json-tree-editor::part(row) { /* one tree row */ }
json-tree-editor::part(key) { }
json-tree-editor::part(value) { }
json-tree-editor::part(type) { }
json-tree-editor::part(chevron) { }
json-tree-editor::part(actions) { }
json-tree-editor::part(input) { }
json-tree-editor::part(disabled) { /* invalid-JSON state panel */ }
```

Also available: `scroll`, `summary`, `type-select`, `action`, `null`.

</details>

On the Solid path, the same CSS variables apply. You can also target BEM-style classes (`.json-tree-row`, and so on) after importing `styles.css`.

---

## Keyboard navigation

Focus a tree row (click the row chrome, or Tab to the active row). Arrow keys move among **visible** rows (depth-first, respecting expand state). Navigation is **disabled** while focus is inside an `input`, `select`, or `textarea` so caret and type controls keep normal Left/Right (and select Up/Down) behavior.

| Key | Action |
| --- | --- |
| `↓` ArrowDown | Next visible row |
| `↑` ArrowUp | Previous visible row |
| `→` ArrowRight | Expand a collapsed container; if already expanded, move to first child |
| `←` ArrowLeft | Collapse an expanded container; if collapsed or a leaf, move to parent |
| Home | First visible row |
| End | Last visible row |

Roving `tabindex` marks one visible `role="treeitem"` as tabbable; others use `-1`.

---

## Demos

Interactive demos are coming soon. Until then, clone the monorepo and run the local demo package (see the [repository README](https://github.com/binaryoperations/json-tree-editor)).

## License

MIT © 2026 Shashank
