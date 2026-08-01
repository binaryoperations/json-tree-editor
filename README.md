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

- Dev server: **http://localhost:5176**
- Build demo: `pnpm build` (or `pnpm -C demo build`)

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
- **Parse:** `parseJsonSource`, `JsonValidity`
- **Path ops:** `getAtPath`, `setAtPath`, `deleteAtPath`, `renameKeyAtPath`,
  `addPropertyAtPath`, `addItemAtPath`, `addShapedItemAtPath`, `cloneJsonShape`,
  `parseCompleteNumber`, `convertJsonType`, `jsonTypeOf`, …
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
  demo/                        # three-pane app
    src/
      App.tsx
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
