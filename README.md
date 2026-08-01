# json-tree-editor

SolidJS **interactive JSON tree editor** extracted as an open-source monorepo.

Edit structured JSON via a collapsible tree (types, keys, primitives, add/remove)
while keeping a free-form source string as the single source of truth.

## Packages

| Package | Path | Description |
| --- | --- | --- |
| `json-tree-editor` | `packages/json-tree-editor` | Publishable library: tree view, path utils, parse helpers, styles |
| `@json-tree-editor/demo` | `demo` | Vite demo: CodeMirror source · tree · formatted preview |

## Quick start

```bash
pnpm install
pnpm dev
```

| Demo | URL | Description |
| --- | --- | --- |
| Main (3-pane) | **http://localhost:5176/** | Source (CM6) · Tree · Formatted |
| Large tree | **http://localhost:5176/large.html** | ~5000-node stress test |

```bash
pnpm dev              # both pages on one Vite server
pnpm dev:large        # same server, opens /large.html
pnpm build            # multi-page build (index + large)
# or: pnpm -C demo build
```

### Large tree stress demo

Runtime generator (`demo/src/lib/generate-large-json.ts`) builds a deterministic
document (seed `42`) with **~5000 nodes**.

**Node count:** every JSON value is one node — objects, arrays, and primitives.
Nested values sum under their parent (same model as tree rows).

**UI:** Tree + stats / formatted preview by default. CodeMirror is **opt-in**
(“Load source editor”) because mounting CM on a full pretty-print of ~5k nodes
can be slow.

**Expand all / Collapse all:** toolbar buttons on the large demo. Expand all
collects every object/array path (`collectContainerPathKeys`) and opens them in
`requestAnimationFrame` chunks so the UI stays responsive (may take 1–3s).
Collapse all resets to root only. The library supports controlled expand via
`expanded` + `onExpandedChange` on `JsonTreeView`.

## Library usage

```tsx
import { JsonTreeView, parseJsonSource } from 'json-tree-editor';
import 'json-tree-editor/styles.css';

const validity = () => parseJsonSource(source());

<JsonTreeView
  validity={validity()}
  onChange={(prettyJson) => setSource(prettyJson)}
/>
```

### Public API (main)

- **Components:** `JsonTreeView` (+ primitives under `components/primitives`)
  - Controlled expand: `expanded`, `onExpandedChange`, `defaultExpanded`
- **Parse:** `parseJsonSource`, `JsonValidity`
- **Path ops:** `getAtPath`, `setAtPath`, `deleteAtPath`, `renameKeyAtPath`,
  `addPropertyAtPath`, `addItemAtPath`, `addShapedItemAtPath`, `cloneJsonShape`,
  `parseCompleteNumber`, `convertJsonType`, `jsonTypeOf`,
  `collectContainerPathKeys`, `defaultExpandedPaths`, `ROOT_PATH_KEY`, …
- **Styles:** `json-tree-editor/styles.css`

## Architecture

```
json-tree-editor/
  packages/json-tree-editor/   # library
    src/
      index.ts
      components/primitives/   # JsonTreeView split into small pieces
      lib/                     # json-path, parseJsonSource
      styles.css
  demo/                        # multi-page Vite app
    index.html                 # main three-pane demo
    large.html                 # ~5k-node stress demo
    src/
      App.tsx
      LargeApp.tsx
      lib/generate-large-json.ts
      components/              # JsonEditor (CM6), JsonFormatted
```

**Sync rules**

1. Source string is sole document truth.
2. Valid parse → tree renders from `validity.value`.
3. Tree edit → immutable path update → pretty `JSON.stringify` → `onChange`.
4. Invalid source → tree shows error state.

## Stack

- SolidJS 1.8 + TypeScript
- Vite 6 (demo)
- CodeMirror 6 (demo source pane only)
- pnpm workspaces

## License

MIT
