# PRD: History Plugin (v3.1 FREEZE)

| Field | Value |
|---|---|
| **Product** | `@binaryoperations/json-tree-editor` |
| **Document** | Product Requirements — History Plugin |
| **Status** | **FROZEN** after planner review + devil’s advocate gap pass |
| **Version** | **3.1** (path-scoped; no full-doc IR) |
| **Date** | 2026-08-13 |
| **Depends on** | [PRD-plugin-system.md](./PRD-plugin-system.md) + **C0 core work** in this doc |
| **Process** | Planner: implementable with C0/meta fixes · DA: **IMPLEMENTABLE WITH PRD PATCHES** → this revision |

### Product law

**Do not store full-document copies on the history stack.**  
Entries are **path-scoped** (subtree clones or O(1) structural ops).  
Whole-file external host rewrites: **`clear` or `skip`** — never full-doc record.

### Process summary

| Role | Finding |
|---|---|
| **Planner** | Direction sound; not a pure observer of today’s meta; need C0, insert helper, path table, reorder indices |
| **Devil’s advocate** | Fatals: meta path semantics, array insert, weak apply guards, dual-pane clear UX, C0 sequencing, double-parse cost, foundation doc contradiction |

---

## 1. Goals (unchanged intent)

| ID | Goal | Pri |
|---|---|---|
| G1 | Commands undo/redo/canUndo/canRedo/readHistory/clearHistory | MUST |
| G2 | Path-scoped IR only — never full-doc string/root pairs | MUST |
| G3 | Memory O(delta × depth), not O(doc × depth) for leaf-heavy use | MUST |
| G4 | String typing one step per focus session | MUST |
| G5 | Apply via `setValue`/`dispatch` + `skipHistory`; apply-then-confirm | MUST |
| G6 | C0: session coalesceKey + focused draft resync | MUST |
| G7 | Solid + WC; `./history` | MUST |
| G8 | External whole-doc: no full-doc entry | MUST |
| G9 | Dual-pane: tree history is tree-local; source pane clears or skips | MUST document |
| G10 | Keyboard helper | SHOULD (H2) |
| G11 | RFC 6902 export of path ops | SHOULD later |

---

## 2. Entry IR (path-scoped)

```ts
type PathReplaceEntry = {
  kind: 'path-replace';
  path: JsonPath;
  before: unknown; // deep clone of subtree only
  after: unknown;
  coalesceKey?: string;
  origin: string;
  commitKind: string;
};

type PathRenameEntry = {
  kind: 'path-rename';
  parentPath: JsonPath;
  fromKey: string;
  toKey: string; // MUST be known at record (meta or fail)
  origin: string;
  commitKind: 'rename';
};

type PathReorderEntry = {
  kind: 'path-reorder';
  arrayPath: JsonPath;
  fromIndex: number; // MUST from meta
  toIndex: number;
  origin: string;
  commitKind: 'reorder';
};

type PathAddEntry = {
  kind: 'path-add';
  path: JsonPath; // full path of NEW node
  value: unknown;
  /** Object key insert position for order restore; optional for arrays */
  keyIndex?: number;
  origin: string;
  commitKind: 'add' | 'duplicate';
};

type PathRemoveEntry = {
  kind: 'path-remove';
  path: JsonPath;
  value: unknown;
  /** Object: index among keys before delete (restore order). Array: implied by path index */
  keyIndex?: number;
  origin: string;
  commitKind: 'delete';
};

type HistoryEntry =
  | PathReplaceEntry
  | PathRenameEntry
  | PathReorderEntry
  | PathAddEntry
  | PathRemoveEntry;
```

| Forbidden on stack | Pri |
|---|---|
| Whole-document `before`/`after` strings | MUST NOT |
| `deepClone(root)` as entry payload for non-root paths | MUST NOT |
| Exception: **root path `[]`** clear/type-change may retain O(doc) as the “subtree” — document and exclude from “≪ doc” leaf tests | MUST document |

---

## 3. Normative meta path table (today vs required)

### 3.1 What core emits today (observation)

| `meta.kind` | `meta.path` meaning |
|---|---|
| `set-value`, `type-change`, `delete`, `clear` | **Node** path |
| `add` | **Parent** container path |
| `duplicate` | **Source** node path |
| `rename` | **Old** node path (includes `fromKey` only) |
| `reorder` | **Array** path only (no indices) |

### 3.2 Required meta enrichment (C0 — core MUST before H1)

Extend `EditorCommitMeta` (or equivalent):

| Kind | Additional fields |
|---|---|
| `rename` | `toKey: string` (or new full path) |
| `reorder` | `fromIndex: number`, `toIndex: number` |
| `add` | `newPath: JsonPath` **or** `newKey` / `newIndex` |
| `duplicate` | `newPath: JsonPath` |
| `set-value` (string live) | `coalesceKey` includes **sessionId** (see C0) |

**Recovery from value-diff alone is NOT default** for reorder (duplicate values ambiguous). If meta missing → **skip record** + warn once. Never invent full-doc.

### 3.3 Building entries

| `kind` | Entry construction |
|---|---|
| `set-value` / `type-change` | `path-replace` at node path |
| `clear` | **`path-replace` only** with `{}` or `[]` at path (no fork) |
| `delete` | `path-remove` at node path; store `keyIndex` for object parents |
| `add` | `path-add` at **newPath** from meta |
| `duplicate` | `path-add` at **newPath** from meta |
| `rename` | `path-rename` with parentPath, fromKey, **toKey** |
| `reorder` | `path-reorder` with arrayPath, **fromIndex**, **toIndex** |
| `plugin` without path | **Skip** (no full-doc) |
| host `external` | clear or skip — **no entry** |

### 3.4 Transient roots (CPU — not stack storage)

| Source | Use |
|---|---|
| `tr.nextRoot` when present | Prefer for **after** snapshot extraction |
| `parse(prevValue)` | **before** extraction; cache last applied root in plugin if needed |
| **MUST NOT** | Happy-path double full-string parse every keystroke when `nextRoot` exists |
| Stack retains | Subtree clones only |

---

## 4. Coalescing

```
coalesceKey = set-value:${pathKey(path)}:${sessionId}  // string live only
```

```
if top is path-replace
   AND top.coalesceKey === K
   AND same path
   AND deepEqualJson(getAtPath(prevRoot, path), top.after):
  top.after = deepClone(newAfter)
  clear redo
else push new; clear redo; trim maxDepth
```

| Rule | Pri |
|---|---|
| **deepEqualJson** = JSON value equality on **subtree** (e.g. recursive or `JSON.stringify` of subtree). **Not** reference equality | MUST |
| Session id: mint on `StringEditor` **focus**; new id after **blur** | MUST |
| Number/boolean: no session key (or single non-session commit) | MUST |
| Bare `set-value:${path}` without session **MUST NOT** be treated as infinite coalesce | MUST |

---

## 5. Apply (materialize)

### 5.1 Invariant

**Only top-of-stack undo/redo** (LIFO). No selective “undo this path” in v3.

### 5.2 Primitives (core helpers)

| Need | Helper |
|---|---|
| Replace value | `setAtPath` |
| Delete key/index | `deleteAtPath` |
| Rename | `renameKeyAtPath` |
| Reorder | `moveArrayItemAtPath` |
| **Array insert / object re-insert with order** | **`insertAtPath` / `insertPropertyAtPath` — MUST add** |

**MUST NOT** implement array undo-delete / redo-add with `setAtPath` alone (overwrites siblings).

### 5.3 Per-entry apply

| Entry | Undo | Redo |
|---|---|---|
| path-replace | set path → `before` | set path → `after` |
| path-rename | rename toKey→fromKey | fromKey→toKey |
| path-reorder | move toIndex→fromIndex | fromIndex→toIndex |
| path-add | deleteAtPath | **insert** value at path |
| path-remove | **insert** value (+ keyIndex for objects) | deleteAtPath |

### 5.4 Preconditions (anti-corruption)

Before mutating stacks on undo of `path-replace`:

```
// Undo expects current@path to still match what we last produced (after)
if !deepEqualJson(getAtPath(root, path), entry.after) → return false
```

Symmetric for redo with `before` as appropriate.

| Policy | Behavior |
|---|---|
| Fail closed | stacks unchanged; optional warn |
| `externalPolicy: 'skip'` | User may hit false often — **preferred over silent wrong path** |
| Missing path / bad parent type | false |

### 5.5 Apply-then-confirm

```
pretty = materialize(...)
if fail → false
ok = ctx.setValue(pretty, { kind: 'plugin', skipHistory: true })
if !ok → false
then pop/push stacks
```

Emit is re-pretty via `stringifyJsonDocument` (formatting may change — accepted; document dual-pane thrash).

---

## 6. External + dual-pane (product)

| Policy | Behavior |
|---|---|
| **`clear` (default)** | Wipe undo/redo on host external |
| **`skip`** | No record; stacks kept; apply guards should fail if structure drifted |
| **`record` full-doc** | **Forbidden** |

### Dual-pane (normative UX)

- Tree-local edits: path history works; host echo does not clear.  
- **Any CodeMirror / source keystroke** → external → **clears** tree history (default).  
- CM keeps **its own** undo.  
- Demo/docs MUST state this; optional: disable tree undo UI after clear / show “history cleared by source edit”.  
- **Do not** claim tree undo survives source-pane editing under default policy.

### Foundation doc supersession

History package and this PRD **override** foundation §6 “external → record” for the history plugin. Update foundation PRD / `history.md` when implementing (process debt from DA).

---

## 7. C0 core checklist (hard gate before H1)

| ID | Work | Pri |
|---|---|---|
| C0.1 | String focus sessionId → coalesceKey | MUST |
| C0.2 | Focused draft resync on external `props.value` change (incl. history) | MUST |
| C0.3 | Reorder `fromIndex`/`toIndex` on commit meta | MUST |
| C0.4 | Rename `toKey` on commit meta | MUST |
| C0.5 | Add/duplicate `newPath` (or key/index) on meta | MUST |
| C0.6 | `insertAtPath` (+ object key order helper) | MUST |
| C0.7 | Prefer `nextRoot` for after extraction in history recorder | MUST |

---

## 8. Commands & options

```ts
type HistoryExternalPolicy = 'clear' | 'skip';

type HistoryPluginOptions = {
  maxDepth?: number; // default 100
  enabled?: boolean; // default true
  externalPolicy?: HistoryExternalPolicy; // default 'clear'
};
```

`readHistory`: meta + `approxBytes` (sum of serialized subtree payloads), no full bodies by default.  
`backend: 'local-path-stack'`.

---

## 9. Phases

| Phase | Content |
|---|---|
| **C0** | Meta enrichment + session coalesce + draft resync + insertAtPath |
| **H0** | Pure path-stack + materialize + unit tests (incl. array insert, memory leaf test) |
| **H1** | Plugin record/apply/commands + dual-pane docs |
| **H1b** | Optional path→RFC 6902 export |
| **H2** | Keyboard + demo buttons |

**Do not start H1 record/apply against production meta until C0 lands.** H0 may use synthetic entries with full fields.

---

## 10. Success criteria

1. Leaf multi-keystroke one session → one undo; **entry size ≪ full doc** (non-root).  
2. Add/delete/rename/reorder/type-change/clear undo correct; array mid-delete undo **inserts**.  
3. External → clear (default); **no** full-doc entry ever.  
4. Echo → no record.  
5. Continuity fail / path drift → undo false, stacks intact.  
6. Focused string undo → draft matches.  
7. No plugin → thin path.  
8. Memory test: N leaf edits on large fixture → stacked bytes O(leaf×N).  
9. Root clear/type-change: may be O(doc); excluded from criterion 1/8 or labeled exception.  
10. Dual-pane: after source keystroke, tree canUndo false (under clear).

---

## 11. Planner + DA outcomes (audit trail)

### Planner: can we implement?

**Yes**, with C0 + meta enrichment + insert helpers. Not as pure meta observer of current code.

### DA fatals addressed in v3.1

| Fatal | Resolution |
|---|---|
| Meta path ambiguity | §3.1–3.2 path table + required fields |
| Array insert | §5.2 insertAtPath MUST |
| Weak apply guards | §5.4 deep-equal continuity for path-replace |
| Dual-pane | §6 normative clear + CM own undo |
| C0 underspec | §7 checklist |
| Double-parse | §3.4 nextRoot preference |
| Foundation record | §6 supersession note |
| Root O(doc) | Exception documented |
| Object key order | keyIndex on remove/add |

### Verdict

**IMPLEMENTABLE** against **v3.1** after C0.  
**NOT** implementable against raw v3.0 prose alone.

---

## 12. Non-goals (still)

- Full-doc stack IR  
- Undo whole-file paste via stored previous file  
- Patch-apply as document protocol  
- CRDT in this PR  
- Expand/focus on stack  
