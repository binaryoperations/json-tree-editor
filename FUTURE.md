# Future features

Backlog only — work not yet done. Shipped capabilities live in package READMEs and `CHANGELOG.md`.

New product features should prefer the **plugin** model (`plugins` / `use`, command registry, master/subordinate) rather than growing core props. See [plans/PRD-plugin-system.md](./plans/PRD-plugin-system.md).

---

## Next

### 1. Array DnD as a plugin

**Today:** array reorder is a first-class editor concern:

- Solid: `arrayReorder={HTML5_ARRAY_REORDER}` from `@binaryoperations/json-tree-editor/dnd`
- Web component: `arrayReorder` / `array-reorder` (default **on**)
- Controllers under `/dnd`; commits via tree meta (`kind: 'reorder'`, indices)

**Target:** DnD as a **plugin** (same model as history), not core props:

- e.g. `arrayReorderPlugin()` / `dndPlugin({ controller })` via `plugins` / `use()`
- Core exposes hooks (reorder commit path, handles, a11y) without shipping HTML5 DnD by default
- WC default-on DnD becomes “install the DnD plugin” (or a documented default plugin set)
- Keep `/dnd` as controller implementation; avoid duplicating HTML5 logic
- History already records `reorder` via commit meta — keep that when DnD is a plugin

**Migration sketch:**

1. Plugin API + lifecycle (bind/unbind, readOnly).  
2. Deprecate Solid `arrayReorder` and WC `array-reorder` in favor of the plugin.  
3. Update demos and README bootstrap snippets.  
4. Changelog: soft deprecation or breaking, per release policy.

### 2. Breadcrumb / path bar

Show current node path; click segments to navigate.

→ Plan: [plans/breadcrumb.md](./plans/breadcrumb.md)

### 3. Collab + follow-user

- CRDT multiplayer via **Yjs** and **Loro** adapters as plugins.
- Separate concern from history; compose via master/subordinate (or collab packages history).
- **Follow user** / presence (peer path, color, follow mode).

→ Notes: [plans/collaboration-plugins.md](./plans/collaboration-plugins.md)

---

## Later

4. **Copy as code** — node/subtree as JSON, JS, TypeScript, etc.  
5. **"Go to" / quick open** — jump to key or path.  
6. **Diff view** — compare two JSONs.  
7. **Table / grid view** — arrays of objects as rows/columns.  
8. **URL / image preview** — detect URLs/images; preview.  
9. **JSON5 / comments** — comments, trailing commas (lower priority).

---

## Suggested order

1. **DnD as plugin** — migrate from `arrayReorder` prop / WC attribute  
2. **Breadcrumb**  
3. **Collab** (Yjs + Loro) + history composition  
4. **Presence + follow user**  
5. Remaining items as plugins where useful  
