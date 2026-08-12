# Undo/Redo History — Implementation Plan

> Status: planned (not started). Companion to [FUTURE.md](../FUTURE.md).  
> Plugin foundation: [plugin-system.md](./plugin-system.md). Collab composition: [collaboration-plugins.md](./collaboration-plugins.md).

## Ownership (plugin model)

History is a **plugin**, not a hard-wired concern inside core `JsonTreeView`.

- **Separate from collab** — collaboration may supply a CRDT undo backend or package history, but history remains its own concern and public API.
- **Commands** (registry; master owns the implementation callers use):

| Command | Role |
|---|---|
| `undo` | Revert one step |
| `redo` | Re-apply one step |
| `canUndo` | Whether undo is available |
| `canRedo` | Whether redo is available |
| `readHistory` | Inspect history (for UI / debugging) |

- **Master / subordinate:** First registrant for these commands is **master**. Later registrants (e.g. collab) are **subordinates** — they do not replace the master; they may attach as a backend if the master allows. Full rule: [plugin-system.md](./plugin-system.md).
- **Prefer pluggable backend under a history master:** `LocalStack` | `YjsUndo` | `LoroUndo` rather than two competing undo stacks.

### Ownership shift from earlier draft

Earlier notes assumed history lived **inside `JsonTreeView`** (prop + handle methods + pure helper). That technical direction (snapshots, coalescing, controlled-value rules) still holds, but **ownership moves** to:

- A **history plugin** (or whichever plugin is **command master**), and
- Core only exposes editor state + transactions + the command registry.

Public host API may still look like handle methods (`undo` / `redo` / …) that **delegate to the registry master**, or keyboard shortcuts that do the same. Implementation of stacks/backends lives outside core tree rendering.

---

## Current architecture (findings)

### Data ownership
- `JsonTreeView` is **controlled**: parent owns `value: string`, receives `onChange(prettyJson: string)`.
- Single funnel:

```
editor/op → immutable path helper → onCommit(nextRoot) → stringifyJsonDocument → props.onChange
```

```ts
const commit = (nextRoot: unknown) => {
  if (props.readOnly) return;
  emitPretty(nextRoot, props.onChange);
};
```

### Edit operations → history steps

| Operation | Commit timing |
|---|---|
| String value edit | **Every keystroke** (`onInput`) — needs coalescing |
| Number / null / key rename | Blur / Enter |
| Boolean / type change / add / delete / clear / duplicate / reorder | Immediate |

### UI state (not on document)
Expand set, focus path, search UI — **must not** create undo steps.

### Existing history
None in the tree. Demo CodeMirror has its own independent history. Dual-pane demo shares one `source` string.

---

## Recommended architecture

### Where history lives
**History plugin / command master**, observing editor commits (or wrapping the transaction path), plus a pure stack helper exported for tests/power users. Default backend: local snapshot stack. Collab may later supply a CRDT backend under the same master (see plugin-system).

```
Host: value + onChange
        ▲ onChange(pretty)     │ value prop
JsonTreeView (core)
  lastEmitted ──► ignore echo of our own onChange
  transaction / commit path
        │
History plugin (command master)
  backend: LocalStack | YjsUndo | LoroUndo
  commit(nextRoot) → record → (core emits) onChange
  undo/redo → onChange(previousPretty)  (same emit path)
```

**Critical rule:** undo/redo restore a known snapshot via `onChange` (or the equivalent transaction). No double-apply of mutations.

---

## Granularity & coalescing

**Operation-level**, not raw keystroke dumps.

String typing: **one undo step per focus session** on that leaf.

```ts
type CommitMeta = {
  coalesceKey?: string; // e.g. set-value + path
  kind?: 'set-value' | 'rename' | 'type-change' | 'add' | 'delete' | 'clear' | 'duplicate' | 'reorder';
};
```

- Same `coalesceKey` as top entry → replace top’s `after` (keep original `before`)
- Else → push new; clear redo
- Structural ops never coalesce with typing

---

## Data model: snapshots (not command pattern)

Default **local-stack** backend:

```ts
type HistoryEntry = {
  before: string; // pretty JSON
  after: string;
  coalesceKey?: string;
  kind?: string;
};
```

**Why snapshots:** type changes lose nested data (inverse needs old subtree anyway); controlled contract is a string; simpler correctness; matches emit path.

CRDT backends (Yjs/Loro) may use their native undo managers instead of pretty-string pairs, while still satisfying the same public commands (`undo`, `redo`, `canUndo`, `canRedo`, `readHistory` adapted as needed).

**v1 (local stack):** document only — no expand/search on stack. Optional soft focus restore if path still exists.

**Memory:** default `maxHistoryDepth = 100`; coalesced typing is one entry.

---

## Public API

### Plugin / registry (preferred long-term)

Commands: `undo`, `redo`, `canUndo`, `canRedo`, `readHistory` — see ownership section and [plugin-system.md](./plugin-system.md).

### Props (may become plugin options)

```ts
// Conceptual — may live on history plugin options, not core props
history?: boolean | { maxDepth?: number }; // default true when plugin loaded
```

### Handle (delegates to command master)

```ts
type JsonTreeViewHandle = {
  getRoot: () => HTMLDivElement | null;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void; // or via readHistory / plugin-specific API
};
```

### Keyboard (on tree root)
| Shortcut | Action |
|---|---|
| `Mod+Z` | Undo |
| `Mod+Shift+Z` | Redo |
| `Mod+Y` (optional) | Redo |

When search input focused: let browser handle. When value/key editor focused: tree undo (native input undo is unreliable with controlled fields).

### Web component
Methods: `undo` / `redo` / `canUndo` / `canRedo` / `clearHistory` (delegate to master)  
Attrs: history options as plugin config when available  
Events: existing `change` / `json-change` only.

### Utils
Export pure `JsonEditHistory` / `createEditHistory` (local-stack backend) from `/utils` or the history package.

---

## Controlled value integration

1. **Record only real commits** — skip if `prevPretty === nextPretty`
2. **Echo suppression** — if `props.value === lastEmitted`, baseline sync only
3. **External value changes** (CodeMirror, host): recommended **record as undoable** + clear redo (best dual-pane). Alternative: clear entire history
4. **Undo apply:** pop undo, push redo, set `applyingHistory`, `onChange(entry.before)`
5. **parse/fix JSON:** not separately stacked; only real document string changes

---

## Edge cases
`readOnly` / history disabled → no record/apply; max depth drop oldest; new edit after undo clears redo; external invalid source as `before` OK; focused string input must resync draft when history applies.

---

## Testing
- Unit: `edit-history.test.ts` (push/undo/redo/coalesce/maxDepth)
- Integration: add/delete/rename/type, string coalescing (one undo for “ab”), echo, external policy, keyboard, history off
- Registry: master/subordinate registration with a mock second plugin (once plugin system exists)

---

## File changes

### New (expected once plugin work starts)
- History plugin package or module + local-stack backend
- `lib/edit-history.ts` + tests (or under the history plugin)
- Integration tests for commands + keyboard

### Touch
- Core: transaction/commit path hooks for plugins; command registry
- `StringEditor.tsx` (coalesce session) as needed for meta
- `web-component.tsx`, utils export surface, README, CHANGELOG, FUTURE.md
- Optional demo Undo/Redo buttons

> Exact file list will shift when the plugin API lands; prefer plugin-owned modules over growing `JsonTreeView.tsx`.

---

## Implementation order
1. Plugin API + command registry (master/subordinate) — see [plugin-system.md](./plugin-system.md)
2. Pure local-stack history core + unit tests  
3. History plugin wired to commit path (accept multi-undo for strings temporarily)  
4. Coalescing + keyboard + focused-input sync  
5. WC + docs + demo  
6. Optional: soft focus, kind labels, adaptive maxDepth; CRDT backends via collab  

---

## Open questions
1. Default on or off when history plugin is present? → **on**
2. External `value` policy: record (A) / clear (B) / tree-only (C)? → **A** for dual-pane
3. Restore expand/selection? → **document only v1**
4. Max depth default **100**?
5. Keep live string commit + coalesce (vs blur-only)? → **live + coalesce**
6. Mod+Y redo? → **yes**
7. Export pure helper from `/utils`? → **yes** (or history package)
8. History when readOnly? → **fully disabled**
9. Invalid external as `before`? → **yes**
10. Does collab package history by default, or only offer a backend? → prefer **history master + pluggable backend**; packaging is an install ergonomics choice (see collab notes)

---

## Summary decisions

| Decision | Choice |
|---|---|
| Owner | **History plugin / command master** (not core tree) |
| Collab | Separate concern; subordinate or packaged history; pluggable backend preferred |
| Public API | Commands: `undo`, `redo`, `canUndo`, `canRedo`, `readHistory` |
| Model (local) | Snapshot pretty JSON (`before`/`after`) |
| Granularity | Operation-level; coalesce string sessions |
| UI state | Not on stack (v1) |
| Host surface | Handle + WC methods + Mod+Z / Mod+Shift+Z delegate to master |
