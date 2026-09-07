# History plugin

**Import:** `@binaryoperations/json-tree-editor/history`

Path-scoped **undo/redo** for `@binaryoperations/json-tree-editor`. Stack entries store **subtree deltas** (and small structural ops), **not** full-document copies.

Parent package docs: [package README](../../README.md). Design: [PRD v3.1](../../../plans/PRD-history-plugin.md).

---

## Install / import

Same package as the editor — no extra npm dependency:

```ts
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';
```

Requires a host that runs the plugin system:

- Solid: `JsonTreeView` with `plugins` / `ref.use`
- Web component: `plugins` property or `use(plugin)` + `callCommand`

---

## Bootstrap

<details>
<summary>Solid</summary>

```tsx
import { createSignal } from 'solid-js';
import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from '@binaryoperations/json-tree-editor';
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';
import '@binaryoperations/json-tree-editor/styles.css';

// Stable instance — plugin identity is by `name` (`'history'`).
const plugins = [historyPlugin({ maxDepth: 50 })];

export function EditorWithHistory() {
  const [json, setJson] = createSignal('{"name":"Ada","score":1}');
  let handle: JsonTreeViewHandle | undefined;

  return (
    <>
      <button
        type="button"
        disabled={handle?.callCommand('canUndo') !== true}
        onClick={() => handle?.callCommand('undo')}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={handle?.callCommand('canRedo') !== true}
        onClick={() => handle?.callCommand('redo')}
      >
        Redo
      </button>
      <JsonTreeView
        value={json()}
        onChange={setJson}
        plugins={plugins}
        ref={(h) => {
          handle = h;
        }}
      />
    </>
  );
}
```

</details>

<details>
<summary>Web component</summary>

```ts
import '@binaryoperations/json-tree-editor/web-component';
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';

const el = document.querySelector('json-tree-editor')!;

// Queues if called before the element is connected
el.use(historyPlugin({ maxDepth: 50 }));
// or: el.plugins = [historyPlugin({ maxDepth: 50 })];

el.value = JSON.stringify({ name: 'Ada', score: 1 }, null, 2);

el.addEventListener('change', () => {
  console.log('canUndo', el.callCommand('canUndo'));
  console.log(el.callCommand('readHistory'));
});

el.callCommand('undo');
```

</details>
---

## Commands

All registered **exclusive** by the history master plugin:

| Command | Signature | Description |
| --- | --- | --- |
| `undo` | `() => boolean` | Revert one path-scoped step |
| `redo` | `() => boolean` | Re-apply one step |
| `canUndo` | `() => boolean` | Whether undo is available |
| `canRedo` | `() => boolean` | Whether redo is available |
| `readHistory` | `() => HistoryReadSnapshot` | Lightweight stack meta (no full entry bodies) |
| `clearHistory` | `() => void` | Empty stacks; document unchanged |

Invoke via Solid handle or WC:

```ts
handle.callCommand('undo');
el.callCommand('canUndo');
```

---

## Options

```ts
historyPlugin({
  maxDepth: 100,           // default 100
  enabled: true,           // default true — false: no record / no-op commands
  externalPolicy: 'clear', // default 'clear' | 'skip'
});
```

| Option | Default | Notes |
| --- | --- | --- |
| `maxDepth` | `100` | Max undo entries (oldest dropped) |
| `enabled` | `true` | When false: no recording; undo/redo return false |
| `externalPolicy` | `'clear'` | Host whole-document rewrite: **wipe** stacks, or **`'skip'`** (keep stacks; path apply fails closed if the tree drifted) |

**Full-document stack payloads are forbidden.** Whole-file host rewrites are not recorded as O(doc) pairs.

---

## Behavior notes

### What gets recorded

Tree (and plugin) commits with path meta: set-value, type-change, clear, add, delete, rename, reorder, etc. Entries are path-scoped (`path-replace`, `path-add`, …).

### Live edits

- **Strings:** commit as you type; one **focus session** → one undo step (session `coalesceKey`).
- **Numbers:** complete finite values live-commit; incomplete drafts (`1.`, `1e`) stay local until complete or blur; session coalesce when applicable.
- **Keys:** rename commits on blur (draft while typing).

### Dual-pane hosts

Tree history is **tree-local**. A CodeMirror / source keystroke is an **external** host write and **clears** tree history under the default policy (the source editor keeps its own undo). Echo of the tree’s own `onChange` does not clear or double-record.

### Plugin identity

`name` is always `'history'`. Changing options requires removing and re-adding the plugin (no option hot-reload by same name).

### Subordinate installs

If another plugin already masters the undo commands, a second history install is subordinate and **inert** (no private stack). Prefer one history master.

---

## `readHistory` shape (summary)

```ts
type HistoryReadSnapshot = {
  backend: 'local-path-stack';
  undoDepth: number;
  redoDepth: number;
  approxBytes: number;
  entries: HistoryEntryMeta[]; // undo side, oldest → newest (meta only)
};
```

Use for toolbars and demos; do not expect full before/after bodies.

---

## Pure helpers (advanced)

Also exported for tests and power users: `createPathStack`, `recordEntry`, `materializeEntry`, `applyUndo` / `applyRedo`, `deepEqualJson`, makers (`makePathReplace`, …). Prefer `historyPlugin` for normal hosts.

---

## Local demos

In the monorepo:

| Page | Description |
| --- | --- |
| `/history.html` | Solid + history (stack UI + bootstrap snippet) |
| `/wc-history.html` | Web component + history |

```bash
pnpm --filter @json-tree-editor/demo dev:history
pnpm --filter @json-tree-editor/demo dev:wc-history
```

---

## Design docs

- [PRD-history-plugin.md](../../../plans/PRD-history-plugin.md) (normative freeze)
- [PRD-plugin-system.md](../../../plans/PRD-plugin-system.md) (plugin runtime)
