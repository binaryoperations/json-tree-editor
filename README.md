# json-tree-editor

Monorepo for **`@binaryoperations/json-tree-editor`**: an interactive JSON tree editor for Solid apps and for any framework via a bundled **web component**.

Edit structured JSON in a collapsible tree (types, keys, primitives, add/remove) while keeping a free-form source string as the single source of truth. Optional **plugins** add capabilities such as path-scoped **undo/redo** without bloating the core editor.

## Library usage

Install and use the publishable package from npm. Install steps, Solid and web-component APIs, plugins, history, theming, and keyboard shortcuts live in the package README:

**→ [json-tree-editor/README.md](./json-tree-editor/README.md)** (`@binaryoperations/json-tree-editor`)

### Surfaces at a glance

| Entry | Use when |
| --- | --- |
| `@binaryoperations/json-tree-editor` | Solid `JsonTreeView` (peer `solid-js`, source import) |
| `…/web-component` | React / Vue / Svelte / vanilla / CDN (`<json-tree-editor>`) |
| `…/history` | Path-scoped undo/redo plugin |
| `…/plugin` | Author plugins (`definePlugin`) |
| `…/dnd` | Array drag-and-drop controller |
| `…/utils` | Parse + path helpers |
| `…/styles.css` | Solid light-DOM styles (WC embeds CSS) |

## Packages

| Package | Path | Description |
| --- | --- | --- |
| `@binaryoperations/json-tree-editor` | `json-tree-editor` | Publishable library: Solid **source** + prebuilt WC |
| `@json-tree-editor/demo` | `demo` | Local Vite demos (Solid, large tree, WC, history plugins) |

## Development

```bash
pnpm install
pnpm build:lib   # builds WC dist/ (needed for WC demos that import prebuilt entry)
pnpm dev         # all demo pages on one Vite server
```

| Demo page | Description |
| --- | --- |
| `/` | Solid three-pane: source (CM6) · tree · formatted |
| `/large.html` | ~5000-node stress test |
| `/wc.html` | Vanilla `<json-tree-editor>` host |
| `/history.html` | Solid + **history plugin** (live stack + bootstrap snippet) |
| `/wc-history.html` | WC + **history plugin** (live stack + bootstrap snippet) |

```bash
pnpm dev                 # all pages
pnpm --filter @json-tree-editor/demo dev:history
pnpm --filter @json-tree-editor/demo dev:wc-history
pnpm build               # WC package then demo multi-page build
pnpm build:lib           # library WC only
pnpm typecheck
pnpm --filter @binaryoperations/json-tree-editor test
```

Drawer nav groups **Plugins** → History (Solid) and History (web component).

## Architecture

```
json-tree-editor/                 # monorepo root
  json-tree-editor/               # library package
    src/
      index.ts                    # Solid exports
      plugin.ts                   # definePlugin + contract types
      history/                    # path-scoped undo plugin (./history)
      web-component.tsx           # <json-tree-editor>
      components/primitives/      # JsonTreeView + editors
      lib/
        editor-runtime/           # dispatch, plugins, command registry
        json-path.ts              # path helpers (incl. insertAtPath)
        parse-json.ts
      styles.css
    dist/                         # WC artifact (web-component.js + .d.ts)
  demo/
    index.html · large.html · wc.html
    history.html · wc-history.html
  plans/                          # design docs (plugin system, history PRDs)
```

**Sync rules**

1. Source string is sole document truth for hosts.
2. `JsonTreeView` parses `value` and renders the tree.
3. Tree edit → immutable path update → pretty `JSON.stringify` → `onChange` / WC events.
4. Invalid source → error banner + last-good tree when possible.
5. Plugins observe document transactions and register commands; they do not replace the host string contract.

### Library surfaces

| Entry | `solid-js` | Notes |
| --- | --- | --- |
| `.` | **External** peer; TS source | Solid apps with a Solid toolchain |
| `./web-component` | **Bundled** in prebuilt JS | Any framework / CDN |
| `./history` | Peer via Solid host, or with WC bundle | Opt-in undo/redo |
| `./styles.css` | n/a | Solid light DOM |

Only the **web component** is built for publish (`dist/web-component.js` + `.d.ts`). Solid and history/plugin/utils consumers import **source**.

## Publishing

Releases target **only** `@binaryoperations/json-tree-editor` (not the monorepo root or demo).

### Prerequisites

- Working tree **clean** (`git status` empty).
- Git user configured.
- npm logged in with access to `@binaryoperations`:
  ```bash
  npm login
  npm whoami
  ```

### Bump only (commit + tag, no publish)

```bash
pnpm version:patch       # → commit + tag vX.Y.Z
pnpm version:minor
pnpm version:major
pnpm version:prerelease
```

Update [`json-tree-editor/CHANGELOG.md`](./json-tree-editor/CHANGELOG.md) for release notes.

### Release (bump + publish)

```bash
pnpm release:patch
pnpm release:minor
pnpm release:major
pnpm release:prerelease
```

Or publish an already-bumped version:

```bash
pnpm publish:json-tree-editor
```

### After release

```bash
git push && git push --tags
```

Do not force-push tags. Do not publish the monorepo root or the demo (`private: true`).

## Stack

- SolidJS 1.8 + TypeScript  
- Vite 6 (`vite-plugin-solid`) — WC library build  
- CodeMirror 6 (demo source panes only)  
- pnpm workspaces  
- Vitest (library tests)  

## Contributing

1. Fork and clone.  
2. `pnpm install` at the monorepo root.  
3. `pnpm dev` for demos; `pnpm --filter @binaryoperations/json-tree-editor test` for unit/integration tests.  
4. Keep the source-string sync rules when changing edit paths.  
5. Prefer plugins for product features (history, collab later) rather than growing core chrome.  
6. Open a PR with a clear description.  

Design notes live under [`plans/`](./plans/) (plugin system PRD, history PRD).

## License

[MIT](./LICENSE) © 2026 Shashank
