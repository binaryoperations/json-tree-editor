# Future features

Ideas to take up as a separate project later. Captured from product notes (2026-03-11).

## High interest

1. **Breadcrumb / path bar** — Show the current node path; click segments to navigate up the tree.  
   → Plan: [plans/breadcrumb.md](./plans/breadcrumb.md)
2. **Undo/redo history** — Stack for tree edits (edit, add, delete, reorder, rename). Keep as first-class.  
   → Plan: [plans/history.md](./plans/history.md)
3. **Real-time collaboration, plugins & follow-user** — Major initiative; own project.  
   → Notes: [plans/collaboration-plugins.md](./plans/collaboration-plugins.md)

### Collaboration suite (detail)

Ship as one coordinated project (dependency order below).

#### Real-time collaboration (Yjs + Loro)

- CRDT-backed multiplayer editing of the JSON document.
- **Both adapters:** integrate **Yjs** and **Loro** via a shared collaboration port/interface so hosts pick one backend without baking either into the core tree.
- Adapter responsibilities (sketch): map document ↔ tree value, apply remote ops, local commits, awareness/presence channel, optional undo integration with CRDT undo managers.
- Core editor stays CRDT-agnostic; adapters are pluggable packages or optional entry points.

#### Plugin API (web component + Solid)

- **Web component plugin surface** — register plugins on `<json-tree-editor>` (and mirror for Solid `JsonTreeView` where it makes sense).
- Plugins can hook into: lifecycle, document change, focus/path change, toolbar/chrome slots, context actions, and collab adapters.
- Keep the public plugin contract small and versioned so adapters (Yjs, Loro) and features (follow user, copy-as-code, previews) can ship as plugins rather than core bloat.

#### Follow another user

- Show remote cursors / focused paths (who is on which node).
- **Follow mode:** viewport and focus track a chosen peer’s path (breadcrumb + expand + scroll), with an easy way to unfollow.
- Depends on presence/awareness from the collab layer (user id, color, current `JsonPath`).

**Suggested build order:** (1) minimal plugin API → (2) collab port + Yjs + Loro adapters → (3) presence UI + follow user.

## Nice to have

4. **Copy as code** — Copy a node or subtree as JSON, JS, TypeScript, etc.
5. **"Go to" / quick open** — Filter-style jump to a key or path (complements in-tree search).
6. **Diff view** — Compare two JSONs (side-by-side or structural / inline).
7. **Table / grid view** — Arrays of objects as editable rows and columns.
8. **URL / image preview** — Detect URL and image strings; show previews inline or on hover.
9. **JSON5 / comments support** — Parse and round-trip comments, trailing commas, etc. (lower priority).

## Already in place

- Collapse on every collapsible node (expands all children under that node).
- Auto-repair / “fix JSON” via `new Function()` wrapping the object string.
