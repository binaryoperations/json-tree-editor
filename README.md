# json-tree-editor

Interactive **JSON tree editor** for Solid apps **and** any framework via a
bundled **web component**.

Edit structured JSON in a collapsible tree (types, keys, primitives, add/remove)
while keeping a free-form source string as the single source of truth.

## Packages

| Package | Path | Description |
| --- | --- | --- |
| `@binaryoperations/json-tree-editor` | `json-tree-editor` | Publishable library: Solid **source** + prebuilt `<json-tree-editor>` WC |
| `@json-tree-editor/demo` | `demo` | Vite demos: Solid 3-pane, large tree, vanilla web component |

## Install

```bash
pnpm add @binaryoperations/json-tree-editor
# Solid apps also need:
pnpm add solid-js
```

## Quick start (monorepo)

```bash
pnpm install
pnpm build:lib   # builds WC dist/ only (needed for WC demo)
pnpm dev
```

| Demo | URL | Description |
| --- | --- | --- |
| Main (Solid) | **http://localhost:5176/** | Source (CM6) · Tree · Formatted |
| Large tree | **http://localhost:5176/large.html** | ~5000-node stress test |
| Web component | **http://localhost:5176/wc.html** | Vanilla host, no Solid app |

```bash
pnpm dev              # all pages on one Vite server
pnpm dev:large        # opens /large.html
pnpm dev:wc           # opens /wc.html (build WC first: pnpm build:lib)
pnpm build            # WC package then demo multi-page build
pnpm build:lib        # @binaryoperations/json-tree-editor WC only
pnpm publish:json-tree-editor  # build + publish library only
pnpm version:patch             # bump lib version, commit + tag vX.Y.Z
pnpm release:patch             # version:patch + publish (then push tags)
pnpm typecheck
```

## Library surfaces

### 1. Solid components (TypeScript source — peer `solid-js`)

Solid consumers import **TypeScript source** directly. Your app must compile it
with a Solid toolchain (`vite-plugin-solid`, etc.). No library JS build is
required for this path.

```tsx
import { JsonTreeView, parseJsonSource } from '@binaryoperations/json-tree-editor';
import '@binaryoperations/json-tree-editor/styles.css';

const validity = () => parseJsonSource(source());

<JsonTreeView
  validity={validity()}
  onChange={(prettyJson) => setSource(prettyJson)}
/>
```

`solid-js` is a **peer dependency**. The package points `exports["."]` at
`./src/index.ts` so Vite (or another bundler) compiles the Solid JSX with your
app’s `solid-js` instance.

### 2. Web component (prebuilt — Solid bundled, no Solid host required)

```html
<script type="module">
  import '@binaryoperations/json-tree-editor/web-component';

  const el = document.querySelector('json-tree-editor');
  el.value = '{"hello":"world"}';

  el.addEventListener('change', (e) => {
    console.log(e.detail.value); // pretty JSON string
  });
  // also: 'json-change' (same detail)
</script>

<json-tree-editor></json-tree-editor>
```

Or set the attribute for small documents:

```html
<json-tree-editor value='{"a":1}'></json-tree-editor>
```

**API**

| Surface | Notes |
| --- | --- |
| Property `value` (string) | Preferred source of truth (especially large JSON) |
| Attribute `value` | Optional; reflected only when length ≤ ~8KB |
| Property / attribute `disabled` | Disables pointer interaction |
| Event `change` | `detail: { value: string }` pretty JSON |
| Event `json-change` | Same payload as `change` (extra alias) |
| Expanded state | Internal by default |

Open **shadow DOM** isolates styles. Theme tokens are set on `:host` so you can
override with inline/`style` attributes or a stylesheet targeting the host.

```js
// After build, CDN-style local path example:
// import from './node_modules/@binaryoperations/json-tree-editor/dist/web-component.js'
```

## Theming

### CSS custom properties

Defaults match the existing dark UI. Override on the host (WC) or `.json-tree` (Solid):

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

| Variable | Role |
| --- | --- |
| `--jte-bg` / `--jte-fg` | Tree surface + default text |
| `--jte-border` / `--jte-border-strong` | Nesting line / control borders |
| `--jte-row-hover` / `--jte-row-focus-bg` | Row chrome |
| `--jte-key` / `--jte-key-root` / `--jte-key-index` | Property keys |
| `--jte-string` / `--jte-number` / `--jte-boolean` / `--jte-null` | Primitive colors |
| `--jte-type-*` / `--jte-type-*-bg` | Type badge colors |
| `--jte-focus-ring` / `--jte-focus-border` | Focus outlines |
| `--jte-font` / `--jte-font-mono` / `--jte-font-size` | Typography |

### `::part` (web component)

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

Also: `scroll`, `summary`, `type-select`, `action`, `null`.

### Solid light DOM

The Solid path still uses BEM-ish classes (`.json-tree-row`, …) plus the same
CSS variables. Import `@binaryoperations/json-tree-editor/styles.css` and override variables or
classes as needed.

## Public API (Solid entry)

- **Components:** `JsonTreeView` (+ primitives under `components/primitives`)
  - Controlled expand: `expanded`, `onExpandedChange`, `defaultExpanded`
  - Keyboard navigation works out of the box (see below)
- **Parse:** `parseJsonSource`, `JsonValidity`
- **Path ops:** `getAtPath`, `setAtPath`, `deleteAtPath`, `renameKeyAtPath`,
  `addPropertyAtPath`, `addItemAtPath`, `addShapedItemAtPath`, `cloneJsonShape`,
  `parseCompleteNumber`, `convertJsonType`, `jsonTypeOf`,
  `collectContainerPathKeys`, `collectVisiblePaths`, `pathDomId`,
  `defaultExpandedPaths`, `ROOT_PATH_KEY`, …
- **Styles:** `@binaryoperations/json-tree-editor/styles.css`
- **Web component:** `@binaryoperations/json-tree-editor/web-component`

### Keyboard navigation (ARIA tree-style)

Focus a tree row (click the row chrome, or Tab to the active row). Arrow keys
move among **visible** rows (DFS with expanded ancestors). Navigation is
**disabled** while focus is inside an `input` / `select` / `textarea` so caret
and type controls keep their normal Left/Right (and select Up/Down) behavior.

| Key | Action |
| --- | --- |
| `↓` ArrowDown | Next visible row |
| `↑` ArrowUp | Previous visible row |
| `→` ArrowRight | Expand a collapsed container; if already expanded, move to first child |
| `←` ArrowLeft | Collapse an expanded container; if collapsed or a leaf, move to parent |
| Home | First visible row |
| End | Last visible row |

Roving `tabindex` marks one visible `role="treeitem"` as `tabIndex={0}`; others
use `-1`. Expand state is the same `expanded` set used by chevrons / expand-all.

## Package exports

```json
{
  ".": {
    "types": "./src/index.ts",
    "solid": "./src/index.ts",
    "import": "./src/index.ts",
    "default": "./src/index.ts"
  },
  "./web-component": {
    "types": "./dist/web-component.d.ts",
    "import": "./dist/web-component.js",
    "default": "./dist/web-component.js"
  },
  "./styles.css": "./src/styles.css",
  "./package.json": "./package.json"
}
```

| Entry | `solid-js` | Use when |
| --- | --- | --- |
| `.` | **External** (peer); TS source | Solid applications with a Solid toolchain |
| `./web-component` | **Bundled** in prebuilt JS | React / Vue / Svelte / vanilla / CDN |

### Build

Only the **web component** is built:

```bash
pnpm --filter @binaryoperations/json-tree-editor build
# or: pnpm build:lib
```

Produces:

- `dist/web-component.js` (+ sourcemap) — Solid bundled
- `dist/web-component.d.ts` — WC public types

There is **no** `dist/index.js`. Solid apps never need a library JS build; build
is only required for WC packaging and the vanilla WC demo page.

## Architecture

```
json-tree-editor/              # monorepo root
  json-tree-editor/            # library package
    src/
      index.ts                 # Solid exports (consumed as source)
      web-component.tsx        # <json-tree-editor> custom element
      components/primitives/   # JsonTreeView + editors
      lib/                     # json-path, parseJsonSource
      styles.css               # CSS variables + classes
    dist/                      # WC artifact only (web-component.js + .d.ts)
  demo/
    index.html                 # Solid three-pane demo
    large.html                 # ~5k-node stress demo
    wc.html                    # vanilla web component demo
```

**Sync rules**

1. Source string is sole document truth.
2. Valid parse → tree renders from `validity.value`.
3. Tree edit → immutable path update → pretty `JSON.stringify` → `onChange` / WC events.
4. Invalid source → tree shows error state.

## Stack

- SolidJS 1.8 + TypeScript
- Vite 6 library mode (`vite-plugin-solid`) — WC only
- CodeMirror 6 (demo source pane only)
- pnpm workspaces

## Publishing

Releases target **only** `@binaryoperations/json-tree-editor` (not the monorepo root or demo).

### Prerequisites

- Working tree must be **clean** (`git status` empty). `npm version` refuses to run otherwise.
- Git user configured (`user.name` / `user.email`).
- npm logged in with publish access to the `@binaryoperations` org:
  ```bash
  npm login
  npm whoami
  # ensure you can publish scoped packages under @binaryoperations
  ```

### Bump only (commit + tag, no publish)

From the monorepo root. Updates `json-tree-editor/package.json`, creates a git **commit** and a **`vX.Y.Z`** tag (leading `v`):

```bash
pnpm version:patch       # 0.1.1 → 0.1.2  → commit + tag v0.1.2
pnpm version:minor       # 0.1.1 → 0.2.0
pnpm version:major       # 0.1.1 → 1.0.0
pnpm version:prerelease  # 0.1.1 → 0.1.2-0  (optional: npm --preid=beta …)
```

### Release (bump + publish)

```bash
pnpm release:patch       # version:patch → build WC → npm publish
pnpm release:minor
pnpm release:major
pnpm release:prerelease
```

Or publish an already-bumped version without bumping again:

```bash
pnpm publish:json-tree-editor   # build + pnpm publish --access public
```

### After release — push commit and tags

Scripts create the commit and tag **locally** only. Push them to the remote when ready:

```bash
git push && git push --tags
# or: git push origin HEAD --tags
```

Do not force-push tags. Do not publish the monorepo root or the demo package (`private: true`).

## License

[MIT](./LICENSE) © 2026 Shashank
