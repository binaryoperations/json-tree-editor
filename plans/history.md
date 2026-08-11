# Undo/Redo History — Implementation Plan

> Status: planned (not started). Companion to [FUTURE.md](../FUTURE.md).  
> User confirmed history should be kept as a first-class feature.

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
**Library-owned inside `JsonTreeView`**, plus a pure stack helper exported for tests/power users.

```
Host: value + onChange
        ▲ onChange(pretty)     │ value prop
JsonTreeView
  lastEmitted ──► ignore echo of our own onChange
  EditHistory (undo/redo stacks of document snapshots)
  commit(nextRoot) → record → emitPretty → onChange
  undo/redo → onChange(previousPretty)  (same emit path)
```

**Critical rule:** undo/redo restore a known snapshot via `onChange`. No double-apply of mutations.

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

```ts
type HistoryEntry = {
  before: string; // pretty JSON
  after: string;
  coalesceKey?: string;
  kind?: string;
};
```

**Why snapshots:** type changes lose nested data (inverse needs old subtree anyway); controlled contract is a string; simpler correctness; matches emit path.

**v1:** document only — no expand/search on stack. Optional soft focus restore if path still exists.

**Memory:** default `maxHistoryDepth = 100`; coalesced typing is one entry.

---

## Public API

### Props
```ts
history?: boolean | { maxDepth?: number }; // default true
```

### Handle
```ts
type JsonTreeViewHandle = {
  getRoot: () => HTMLDivElement | null;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
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
Methods: `undo` / `redo` / `canUndo` / `canRedo` / `clearHistory`  
Attrs: `history`, `history-max-depth`  
Events: existing `change` / `json-change` only.

### Utils
Export pure `JsonEditHistory` / `createEditHistory` from `/utils`.

---

## Controlled value integration

1. **Record only real commits** — skip if `prevPretty === nextPretty`
2. **Echo suppression** — if `props.value === lastEmitted`, baseline sync only
3. **External value changes** (CodeMirror, host): recommended **record as undoable** + clear redo (best dual-pane). Alternative: clear entire history
4. **Undo apply:** pop undo, push redo, set `applyingHistory`, `onChange(entry.before)`
5. **parse/fix JSON:** not separately stacked; only real document string changes

---

## Edge cases
`readOnly` / `history={false}` → no record/apply; max depth drop oldest; new edit after undo clears redo; external invalid source as `before` OK; focused string input must resync draft when history applies.

---

## Testing
- Unit: `edit-history.test.ts` (push/undo/redo/coalesce/maxDepth)
- Integration: add/delete/rename/type, string coalescing (one undo for “ab”), echo, external policy, keyboard, `history={false}`

---

## File changes

### New
- `lib/edit-history.ts` + tests
- `JsonTreeView.history.test.tsx`

### Touch
- `JsonTreeView.tsx` (stack, commit wrap, shortcuts, handle)
- `StringEditor.tsx` (coalesce session)
- `PrimitiveEditor.tsx` / `JsonTreeNode.tsx` (thread meta)
- `web-component.tsx`, `utils.ts`, README, CHANGELOG, FUTURE.md
- Optional demo Undo/Redo buttons

---

## Implementation order
1. Pure history core + unit tests  
2. Wire into `JsonTreeView` (accept multi-undo for strings temporarily)  
3. Coalescing + keyboard + focused-input sync  
4. WC + docs + demo  
5. Optional: soft focus, kind labels, adaptive maxDepth  

---

## Open questions
1. Default on or off? → **on**
2. External `value` policy: record (A) / clear (B) / tree-only (C)? → **A** for dual-pane
3. Restore expand/selection? → **document only v1**
4. Max depth default **100**?
5. Keep live string commit + coalesce (vs blur-only)? → **live + coalesce**
6. Mod+Y redo? → **yes**
7. Export pure helper from `/utils`? → **yes**
8. History when readOnly? → **fully disabled**
9. Invalid external as `before`? → **yes**

---

## Summary decisions

| Decision | Choice |
|---|---|
| Owner | `JsonTreeView` + pure helper |
| Model | Snapshot pretty JSON (`before`/`after`) |
| Granularity | Operation-level; coalesce string sessions |
| UI state | Not on stack (v1) |
| API | `history` prop, handle + WC methods, Mod+Z / Mod+Shift+Z |
