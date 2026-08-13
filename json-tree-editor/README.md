# @binaryoperations/json-tree-editor

Interactive **JSON tree editor** you can drop into any app: edit keys, types, and primitives in a collapsible tree while treating a JSON **string** as the single source of truth.

Use it as a **SolidJS component** (TypeScript source, peer `solid-js`) or as a framework-agnostic **web component** (`<json-tree-editor>` with Solid bundled).

### Highlights

- Collapsible object/array tree with type changes, rename, add/delete, clear, duplicate  
- Controlled `value` / `onChange` (pretty JSON string)  
- Optional **plugins** (e.g. path-scoped **history** / undo-redo)  
- In-tree search (Cmd/Ctrl+F), optional array drag-reorder, read-only mode  
- CSS variables + `::part` theming  

---

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
| `@binaryoperations/json-tree-editor` | `JsonTreeView` + props/handle types (peer `solid-js`) |
| `@binaryoperations/json-tree-editor/plugin` | `definePlugin` + plugin contract types |
| `@binaryoperations/json-tree-editor/history` | Path-scoped undo/redo — **opt-in** ([history README](./src/history/README.md)) |
| `@binaryoperations/json-tree-editor/dnd` | Array drag-and-drop (`HTML5_ARRAY_REORDER`, …) — **opt-in** |
| `@binaryoperations/json-tree-editor/utils` | Parse helpers, path utilities, lower-level primitives |
| `@binaryoperations/json-tree-editor/web-component` | Prebuilt `<json-tree-editor>` (Solid bundled; DnD on by default) |
| `@binaryoperations/json-tree-editor/styles.css` | Styles for the Solid path (WC embeds styles in shadow DOM) |

---

## Quick start

<details>
<summary>Solid</summary>

```tsx
import { createSignal } from 'solid-js';
import { JsonTreeView } from '@binaryoperations/json-tree-editor';
import '@binaryoperations/json-tree-editor/styles.css';

export function JsonPanel() {
  const [source, setSource] = createSignal('{"hello":"world"}');

  return (
    <JsonTreeView
      value={source()}
      onChange={(prettyJson) => setSource(prettyJson)}
    />
  );
}
```

</details>

<details>
<summary>Web component (HTML)</summary>

```html
<script type="module">
  import '@binaryoperations/json-tree-editor/web-component';

  const el = document.querySelector('json-tree-editor');
  el.value = JSON.stringify({ hello: 'world', count: 1 }, null, 2);

  el.addEventListener('change', (e) => {
    console.log(e.detail.value); // pretty JSON string
  });
</script>

<json-tree-editor></json-tree-editor>
```

</details>

<details>
<summary>Web component (TypeScript host)</summary>

```ts
import '@binaryoperations/json-tree-editor/web-component';
import type { JsonTreeEditorElement } from '@binaryoperations/json-tree-editor/web-component';

const el = document.querySelector('json-tree-editor') as JsonTreeEditorElement;
el.value = '{"name":"Ada"}';

el.addEventListener('change', (event) => {
  const { value } = (event as CustomEvent<{ value: string }>).detail;
  console.log(value);
});
```

</details>

---

## SolidJS API

Import styles once in your app entry or layout:

```ts
import '@binaryoperations/json-tree-editor/styles.css';
```

### `JsonTreeView` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `value` | `string` | yes | JSON document source (parsed internally) |
| `onChange` | `(prettyJson: string) => void` | yes | Called after an edit with pretty JSON (2-space indent) |
| `defaultExpandedDepth` | `number` | no | Nesting levels open on mount (`0` = root only, default) |
| `arrayReorder` | `ArrayReorderController \| false` | no | Array drag-reorder. Omit / `false` = off. Pass `HTML5_ARRAY_REORDER` from `/dnd` |
| `plugins` | `JsonTreeEditorPlugin[]` | no | Editor plugins (e.g. `historyPlugin()`). Stable by plugin `name` |
| `readOnly` | `boolean` | no | Browse/expand only; no mutations |
| `search` | `boolean` | no | In-tree find (Cmd/Ctrl+F). Default `true` |
| `ref` | handle or callback | no | Imperative API (see below) |

### Ref handle

| Method | Description |
| --- | --- |
| `getRoot()` | Root `.json-tree` DOM element (or `null` before mount) |
| `use(plugin)` | Register a plugin; returns dispose |
| `callCommand(name, …args)` | Invoke a registered command (e.g. history `undo`) |
| `hasCommand(name)` | Whether a command is registered |

Keep the source string as document truth: pass it as `value`, push tree edits back via `onChange`.

**Root rules** (applied inside the view): blank source → valid empty object `{}`. Root must be an **object or array**. Syntax errors keep a last-good tree visible with an error banner; tree edits still emit pretty JSON so you can recover.

---

## Plugins

Plugins are opt-in modules that observe document transactions and register **commands**. Core stays free of undo stacks / CRDTs.

| Surface | How |
| --- | --- |
| Solid | `plugins={[myPlugin()]}` and/or `handle.use(myPlugin())` |
| Web component | `el.plugins = […]` and/or `el.use(plugin)` (queues until connected) |
| Commands | `handle.callCommand('…')` / `el.callCommand('…')` |

Command registry: **first registrant is master** for a command name; later plugins are subordinates. Types: `@binaryoperations/json-tree-editor/plugin`. Architecture: [plugin system PRD](../plans/PRD-plugin-system.md).

<details>
<summary>Authoring sketch</summary>

```tsx
import { definePlugin } from '@binaryoperations/json-tree-editor/plugin';
// JsonTreeEditorPlugin: { name, setup(ctx) { … } }
```

</details>

---

## History plugin

**Import:** `@binaryoperations/json-tree-editor/history`

Path-scoped undo/redo — subtree deltas on the stack, not full-document copies.

**→ Full docs: [src/history/README.md](./src/history/README.md)**  
Design: [history PRD](../plans/PRD-history-plugin.md).

<details>
<summary>Minimal Solid wire-up</summary>

```tsx
import { JsonTreeView } from '@binaryoperations/json-tree-editor';
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';

const plugins = [historyPlugin({ maxDepth: 50 })];

<JsonTreeView value={json()} onChange={setJson} plugins={plugins} />
// handle.callCommand('undo' | 'redo' | 'canUndo' | 'readHistory' | …)
```

</details>

<details>
<summary>Minimal web component wire-up</summary>

```ts
import '@binaryoperations/json-tree-editor/web-component';
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';

const el = document.querySelector('json-tree-editor')!;
el.use(historyPlugin({ maxDepth: 50 }));
el.callCommand('undo');
```

</details>

---

## Web component API

| Surface | Type | Notes |
| --- | --- | --- |
| Property `value` | `string` | Preferred source of truth (esp. large JSON) |
| Attribute `value` | `string` | Optional; reflected only when length ≤ ~8KB |
| `defaultExpandedDepth` / `default-expanded-depth` | `number` | Nesting levels open on mount (default `0`) |
| `readOnly` / `readonly` | `boolean` | Browse/expand only |
| `arrayReorder` / `array-reorder` | `boolean` | Array DnD (default **on** for WC). Set `false` to disable |
| `search` | `boolean` | In-tree find (default **on**) |
| Property `plugins` | `JsonTreeEditorPlugin[]` | Replace plugin set (no HTML attribute) |
| Method `use(plugin)` | `() => void` dispose | Register one plugin (pre-connect queue OK) |
| Method `callCommand(name, …)` | varies | Invoke plugin commands |
| Method `hasCommand(name)` | `boolean` | Command registered? |
| Method `getRoot()` | `HTMLDivElement \| null` | `.json-tree` in shadow DOM |
| Event `change` / `json-change` | `CustomEvent<{ value: string }>` | After tree edit (pretty JSON) |

Styles live in an **open shadow DOM**. Theme tokens sit on `:host` (see [Theming](#theming)).

---

## DnD (`/dnd`)

Array reorder is **opt-in** on Solid so the core entry stays smaller. The web component enables HTML5 DnD by default. Also exports types and path helpers for custom controllers.

<details>
<summary>Solid example</summary>

```tsx
import { JsonTreeView } from '@binaryoperations/json-tree-editor';
import { HTML5_ARRAY_REORDER } from '@binaryoperations/json-tree-editor/dnd';

<JsonTreeView
  value={source()}
  onChange={setSource}
  arrayReorder={HTML5_ARRAY_REORDER}
/>
```

</details>

---

## Utils (`/utils`)

Path helpers (`getAtPath`, `setAtPath`, `insertAtPath`, …), parse helpers (`parseJsonSource`, `JsonValidity`), and lower-level primitives. Most apps only need the package root.

---

## Theming

Defaults match a dark editor chrome. Override CSS variables on the web component host or on `.json-tree` (Solid light DOM).

| Variable group | Role |
| --- | --- |
| `--jte-bg` / `--jte-fg` | Tree surface and default text |
| `--jte-border` / `--jte-border-strong` | Nesting and control borders |
| `--jte-row-hover` / `--jte-row-focus-bg` | Row chrome |
| `--jte-key` / `--jte-key-root` / `--jte-key-index` | Property keys |
| `--jte-string` / `--jte-number` / `--jte-boolean` / `--jte-null` | Primitive colors |
| `--jte-type-*` | Type badge colors |
| `--jte-focus-ring` / `--jte-focus-border` | Focus outlines |
| `--jte-font` / `--jte-font-mono` / `--jte-font-size` | Typography |

<details>
<summary>Example token overrides</summary>

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

</details>

<details>
<summary>Web component <code>::part</code> hooks</summary>

```css
json-tree-editor::part(tree) { /* .json-tree root */ }
json-tree-editor::part(scroll) { }
json-tree-editor::part(row) { }
json-tree-editor::part(key) { }
json-tree-editor::part(value) { }
json-tree-editor::part(type) { /* type <select> */ }
json-tree-editor::part(chevron) { }
json-tree-editor::part(actions) { }
json-tree-editor::part(input) { }
json-tree-editor::part(search) { }
json-tree-editor::part(disabled) { /* invalid-JSON panel */ }
```

Also: `summary`, `action`, `null`.

</details>

On the Solid path, the same variables apply; you can also target BEM classes (`.json-tree-row`, …) after importing `styles.css`.

---

## Keyboard

Focus a tree row (or Tab to the active row). Arrow keys move among **visible** rows. Navigation is **disabled** while focus is inside an `input`, `select`, or `textarea`.

| Key | Action |
| --- | --- |
| `↓` / `↑` | Next / previous visible row |
| `→` | Expand collapsed container, else first child |
| `←` | Collapse expanded container, else parent |
| Home / End | First / last visible row |
| Cmd/Ctrl+F | Open in-tree find (when `search` enabled) |

Roving `tabindex` keeps one visible `role="treeitem"` tabbable.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Demos

Clone the monorepo and run the local demo package (see the [repository README](https://github.com/binaryoperations/json-tree-editor)):

| Page | Description |
| --- | --- |
| `/` | Solid three-pane editor |
| `/large.html` | ~5k-node stress test |
| `/wc.html` | Vanilla web component host |
| `/history.html` | Solid + `historyPlugin` (stack UI + bootstrap snippet) |
| `/wc-history.html` | WC + `historyPlugin` (stack UI + bootstrap snippet) |

<details>
<summary>Run demos locally</summary>

```bash
pnpm install
pnpm dev
# or: pnpm --filter @json-tree-editor/demo dev:history
```

</details>

## License

MIT © 2026 Shashank
