# Future features

Ideas to take up as a separate project later. Captured from product notes (2026-03-11) and refined for a plugin-first architecture.

## Highest priority — foundation

### 1. Plugin system + editor state

The editor needs a **plugin system**. Features should not be hard-wired into the core tree; they register as plugins and **manage their own state**.

Architectural direction:

- **Editor state** — central surface the core owns (document, focus path, expand set, read-only, …) plus a transaction/update path.
- **Plugins** own private state; core does not know about undo stacks or CRDT docs.
- Register on Solid `JsonTreeView` and the web component (`use(plugin)` / `plugins` API).
- **Commands** are a shared registry. Overlapping registrations follow the **master / subordinate** rule below.

→ Notes: [plans/plugin-system.md](./plans/plugin-system.md)

### 2. Conflict rule (general): master / subordinate

**First registrant** for a named capability or command is the **master**. The master owns the public API callers use.

**Later registrants** for the same name are **subordinates**. They do **not** replace the master. They may:

- Attach as a backend or delegate **if the master allows it**, or
- Stay passive (loaded but not serving that command).

This rule applies to **any** overlapping plugins — history, collab, clipboard, go-to, and so on — not only history. Prefer this over last-wins (silent breakage) or throw-on-second (hostile to composition).

→ Full rationale and API sketch: [plans/plugin-system.md](./plans/plugin-system.md)

### 3. History

Undo/redo for tree edits. **Separate concern** from collaboration.

History is a **plugin** exposing commands:

| Command | Role |
|---|---|
| `undo` | Revert one step |
| `redo` | Re-apply one step |
| `canUndo` | Whether undo is available |
| `canRedo` | Whether redo is available |
| `readHistory` | Inspect history (for UI / debugging) |

Prefer a **history master** with a **pluggable backend** (`LocalStack` vs CRDT undo such as Yjs/Loro). Collab may package history and/or load as a **subordinate** that supplies a CRDT backend when the history master allows it. **First registrant is master** if both history and collab register the same commands.

→ Plan: [plans/history.md](./plans/history.md)

### 4. Collab + follow-user

- CRDT multiplayer via **Yjs** and **Loro** adapters as plugins.
- Collab is a **separate concern** from history; composition uses the master/subordinate rule (package history, or subordinate + supply backend).
- **Follow user** / presence via awareness (peer path, color, follow mode).

→ Notes: [plans/collaboration-plugins.md](./plans/collaboration-plugins.md)

### 5. Breadcrumb / path bar

Show current node path; click segments to navigate.

→ Plan: [plans/breadcrumb.md](./plans/breadcrumb.md)

## High interest (after foundation)

6. **Copy as code** — Copy node/subtree as JSON, JS, TypeScript, etc.
7. **"Go to" / quick open** — Filter-style jump to key or path.
8. **Diff view** — Compare two JSONs.
9. **Table / grid view** — Arrays of objects as rows/columns.
10. **URL / image preview** — Detect URLs/images; preview.
11. **JSON5 / comments** — Lower priority; comments, trailing commas.

## Suggested build order

1. **Plugin API + command registry** (master / subordinate)
2. **History plugin** (`undo` / `redo` / `canUndo` / `canRedo` / `readHistory`)
3. **Breadcrumb**
4. **Collab packages** (Yjs + Loro adapters; history composition)
5. **Presence + follow user**
6. Remaining features as plugins where useful

## Already in place

- Collapse on every collapsible node (expands all children under that node).
- Auto-repair / “fix JSON” via `new Function()` wrapping the object string.
- In-tree search (Cmd/Ctrl+F).
