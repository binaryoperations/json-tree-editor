# json-tree-editor

Monorepo for **`@binaryoperations/json-tree-editor`**: an interactive JSON tree editor for Solid apps and for any framework via a bundled **web component**.

Edit structured JSON in a collapsible tree (types, keys, primitives, add/remove) while keeping a free-form source string as the single source of truth.

## Library usage

Install and use the publishable package from npm. Full install steps, Solid and web-component APIs, theming, and keyboard shortcuts live in the package README:

**→ [json-tree-editor/README.md](./json-tree-editor/README.md)** (`@binaryoperations/json-tree-editor`)

## Packages

| Package | Path | Description |
| --- | --- | --- |
| `@binaryoperations/json-tree-editor` | `json-tree-editor` | Publishable library: Solid **source** + prebuilt `<json-tree-editor>` WC |
| `@json-tree-editor/demo` | `demo` | Local Vite demos: Solid 3-pane, large tree, vanilla web component |

## Development

```bash
pnpm install
pnpm build:lib   # builds WC dist/ only (needed for WC demo)
pnpm dev         # demo app (all pages on one Vite server)
```

| Demo page | Description |
| --- | --- |
| `/` | Solid three-pane: source (CM6) · tree · formatted |
| `/large.html` | ~5000-node stress test |
| `/wc.html` | Vanilla host, no Solid app (run `pnpm build:lib` first) |

```bash
pnpm dev              # all pages on one Vite server
pnpm build            # WC package then demo multi-page build
pnpm build:lib        # @binaryoperations/json-tree-editor WC only
pnpm typecheck
```

Hosted demos are coming soon.

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

### Library surfaces (summary)

| Entry | `solid-js` | Use when |
| --- | --- | --- |
| `.` | **External** (peer); TypeScript source | Solid apps with a Solid toolchain |
| `./web-component` | **Bundled** in prebuilt JS | React / Vue / Svelte / vanilla / CDN |
| `./styles.css` | n/a | Solid light DOM (WC embeds styles) |

Only the **web component** is built (`dist/web-component.js` + `.d.ts`). Solid consumers import source; no library JS build is required for that path.

## Publishing

Releases target **only** `@binaryoperations/json-tree-editor` (not the monorepo root or demo).

### Prerequisites

- Working tree must be **clean** (`git status` empty). `npm version` refuses to run otherwise.
- Git user configured (`user.name` / `user.email`).
- npm logged in with publish access to the `@binaryoperations` org:
  ```bash
  npm login
  npm whoami
  ```

### Bump only (commit + tag, no publish)

From the monorepo root. Updates `json-tree-editor/package.json`, creates a git **commit** and a **`vX.Y.Z`** tag:

```bash
pnpm version:patch       # 0.1.1 → 0.1.2  → commit + tag v0.1.2
pnpm version:minor
pnpm version:major
pnpm version:prerelease
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

### After release

Scripts create the commit and tag **locally** only. Push them when ready:

```bash
git push && git push --tags
```

Do not force-push tags. Do not publish the monorepo root or the demo package (`private: true`).

## Stack

- SolidJS 1.8 + TypeScript
- Vite 6 library mode (`vite-plugin-solid`) — WC only
- CodeMirror 6 (demo source pane only)
- pnpm workspaces

## Contributing

1. Fork and clone the repo.
2. `pnpm install` at the monorepo root.
3. Develop against the demo (`pnpm dev`) or typecheck the library (`pnpm typecheck`).
4. Keep the source-string sync rules above when changing edit paths.
5. Open a PR with a clear description of the change.

## License

[MIT](./LICENSE) © 2026 Shashank
