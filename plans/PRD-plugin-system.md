# PRD: Plugin System Foundation (v1.1 FREEZE)

| Field | Value |
|---|---|
| **Product** | `@binaryoperations/json-tree-editor` |
| **Document** | Product Requirements — Plugin System Foundation |
| **Status** | **FROZEN** (planner + devil’s advocate consensus: FREEZE WITH NITS) |
| **Version** | 1.1 |
| **Date** | 2026-08-12 |
| **Supersedes** | Exploratory proposal v1; backlog notes in `plugin-system.md` for *direction* only — this PRD is normative |
| **Next** | Architecture + implementation (P0–P4); history plugin is a separate PRD/PR |

### Consensus statement

Foundation is a **thin, trusted-plugin runtime**: the host keeps the pretty JSON string; core owns parsing/display and emits **document-only** transactions through a **single `dispatch` funnel**, with **core-supplied commit meta**; plugins register by **name**, observe commits, and expose work via a **first-wins command registry**; **history and collab stay out of core**, compose via **history-owned backends** and **documented install recipes**; **UI chrome stays core**; **zero plugins stay cheap**. No UI transaction bus, no generic attach framework, no promote-on-teardown, no marketplace or untrusted-plugin security story.

---

## 1. Problem statement

### 1.1 Problem

Product features that need document lifecycle awareness (undo/redo, multiplayer, go-to, copy-as, presence) currently have no extension surface. Growing them into `JsonTreeView.tsx` would:

- Couple rendering to product features.
- Duplicate work across Solid and web-component surfaces.
- Prevent composition when two features claim the same capability (e.g. local undo vs CRDT undo).
- Leave no home for **plugin-private state** while the host still owns the controlled `value` string.

### 1.2 Opportunity

Extract a small **editor runtime** behind the existing controlled API so:

1. Core remains a focused JSON tree editor.
2. History, collab, and later features ship as plugins.
3. Solid and WC hosts use the same plugin modules.

### 1.3 Users

| User | Need |
|---|---|
| Library maintainers | Safe place to add history/collab without core bloat |
| App hosts (Solid) | `plugins={[…]}` / `ref.use(plugin)` |
| App hosts (WC / React / Vue / vanilla) | `el.use(plugin)` / `el.plugins = […]` without Solid knowledge |
| Plugin authors | Stable `PluginContext`, commit meta, command registry |

---

## 2. Goals and non-goals

### 2.1 Goals

| ID | Goal | Priority |
|---|---|---|
| G1 | Plugins register with **private state**; core does not know undo stacks or CRDT docs | MUST |
| G2 | **Single document funnel**: all doc changes go through `dispatch` | MUST |
| G3 | Plugins **observe** doc commits via `onTransaction` with stable meta | MUST |
| G4 | **Command registry**: first registrant is **master**; subordinates do not serve callers | MUST |
| G5 | Solid + web component registration parity | MUST |
| G6 | Controlled `value` / `onChange` remains the host document API | MUST |
| G7 | Foundation unblocks **history next**, **collab after**, without redesign | MUST |
| G8 | Core stays **CRDT-agnostic** | MUST |
| G9 | Zero-plugin path stays **cheap** (thin path) | MUST |
| G10 | Existing demos/tests keep current UX when no plugins | MUST |

### 2.2 Non-goals (foundation)

| Non-goal | Notes |
|---|---|
| UI transactions (focus / expand / search on the bus) | Stay private core state |
| `filterTransaction` | Phase-2 if a real plugin needs veto |
| Generic attach-point framework | History **package** owns backend attach |
| Promote-on-teardown | Commands die with master |
| Marketplace / discovery / untrusted plugins | Trusted modules only |
| Built-in history, collab, undo keybindings | Separate PRs / packages |
| Async `setup` | Sync only |
| Moving search, breadcrumb, DnD into plugins | Core chrome |
| Typed command map codegen | Docs freeze names; types optional later |
| CRDT performance / partial tree apply | Later if profiling requires |

---

## 3. Core vs plugin line

| Feature | Owner |
|---|---|
| Parse / displayRoot / invalid-JSON banner | Core |
| Expand / focus / tree keyboard nav | Core |
| Search (Cmd/Ctrl+F, bar, highlights) | Core |
| Array DnD (`arrayReorder`) | Core |
| Breadcrumb (when built) | Core chrome first |
| Document commit path + `lastEmitted` | Core |
| Plugin registry + command registry | Core |
| Undo/redo stacks / CRDT docs | Plugins |
| Presence / follow-user | Plugins |
| Go-to, copy-as-code, previews | Plugins later |

---

## 4. Functional requirements

### 4.1 Single mutation funnel

| ID | Requirement |
|---|---|
| FR-1 | All document mutations apply through `dispatch(EditorTransaction)` |
| FR-2 | `setValue` on `PluginContext` is **sugar only** — builds a transaction and calls `dispatch` |
| FR-3 | UI tree commits (`commit` today) become `dispatch({ nextRoot, meta })` |
| FR-4 | Host `props.value` / WC `value` changes classify as echo vs external (see §6) |
| FR-5 | Exactly one of `nextRoot` \| `nextValue` per transaction; both/neither → reject (`false`) |
| FR-6 | `readOnly` → doc `dispatch` returns `false`; no emit; no plugin notify |

### 4.2 Transactions (document-only)

| ID | Requirement |
|---|---|
| FR-7 | Foundation supports **document-only** transactions — no focus/expand/search txs |
| FR-8 | Core annotates UI commits with `origin`, `kind`, `path?`, `coalesceKey?`, `skipHistory`, `echo` |
| FR-9 | Structural ops (add/delete/rename/type-change/reorder/clear/duplicate) get accurate `kind` + `path` when known |
| FR-10 | String keystroke `coalesceKey` **MAY** complete with history PR; foundation wires structural ops and the meta field |

**Normative coalesce example (for history alignment):**

```text
coalesceKey = `set-value:${pathKey(path)}`
```

History interprets: same key as top entry while a leaf string session is open → replace `after`; blur/new path → new entry. Core transports the key; history owns stack rules.

### 4.3 Observation

| ID | Requirement |
|---|---|
| FR-11 | `onTransaction(cb)` runs after a document transaction is applied (see §6 for echo exception) |
| FR-12 | Event includes `tr`, `value`, `prevValue`, `didEmit`, `state` (post-apply snapshot) |
| FR-13 | No `filterTransaction` in foundation |
| FR-14 | Re-entrant `dispatch` from `onTransaction` is **queued** and flushed after the current notify wave; max depth **8**; beyond that `console.error` and drop |
| FR-15 | At most one `onChange` emission per outer dispatch turn (queued follow-ups may emit again as separate turns) |

### 4.4 Plugins

| ID | Requirement |
|---|---|
| FR-16 | Plugin shape: `{ name: string; setup(ctx): void | (() => void) }` |
| FR-17 | `name` unique per editor instance; duplicate → `console.error`, skip second `setup` |
| FR-18 | Identity for prop updates = `name` only; same name → do not re-run `setup` (no option hot-reload) |
| FR-19 | Hosts MUST use stable plugin instances / names; options change = remove name then re-add |
| FR-20 | Teardown disposer runs on unmount, name removal, `use()` dispose, WC disconnect; runs even if another plugin throws (isolate errors) |
| FR-21 | Teardown timing: no new `dispatch` from a plugin after its disposer starts; in-flight outer turn finishes, then disposer |

### 4.5 Commands

| ID | Requirement |
|---|---|
| FR-22 | First `registerCommand(name)` is **master**; only master serves `callCommand` |
| FR-23 | Later registrants are **subordinates**; impl not called; optional `onBecomeSubordinate` |
| FR-24 | No last-wins; no throw-on-second for non-exclusive |
| FR-25 | `exclusive: true` + subordinate = **broken install** → `console.error` once per registration (dev and prod); master continues |
| FR-26 | Master teardown → command **removed** (no promote-on-teardown) |
| FR-27 | Missing command: `callCommand` → `undefined`; `hasCommand` → `false`; no throw |
| FR-28 | Well-known names (not implemented in foundation): `undo`, `redo`, `canUndo`, `canRedo`, `readHistory` |

**Signatures (docs freeze):**

| Command | Signature |
|---|---|
| `undo` / `redo` | `() => boolean` |
| `canUndo` / `canRedo` | `() => boolean` |
| `readHistory` | `() => unknown` |

**Toolbar / `canUndo`:** no core subscription bus. UIs re-query `callCommand('canUndo')` on `onTransaction` (or keep state inside the history plugin / host). History may later expose a small store; out of foundation scope.

**Handle convenience `undo()`:** not in foundation. History package or a later PR may add thin wrappers; until then hosts use `callCommand('undo')`.

### 4.6 History / collab composition (docs + soft validation)

| ID | Requirement |
|---|---|
| FR-29 | Core does **not** implement attach points |
| FR-30 | History package owns backend attach API when it lands |
| FR-31 | Document recipes A–D (appendix); optional known-pair `console.error` if cheap |
| FR-32 | Accidental reverse order with dual exclusive commands is a **broken install**, not supported composition |

### 4.7 Surfaces

| ID | Requirement |
|---|---|
| FR-33 | Solid: optional `plugins?: JsonTreeEditorPlugin[]` |
| FR-34 | Handle: `getRoot`, `use(plugin) => dispose`, `callCommand`, `hasCommand` |
| FR-35 | WC: `use`, `plugins` setter, `callCommand`, `hasCommand`; no HTML attributes for plugins |
| FR-36 | WC: queue `use`/`plugins` until runtime ready; dispose all on `disconnectedCallback` |
| FR-37 | WC reconnect does not auto-revive disposed plugins; host must re-register |

### 4.8 Thin path

| ID | Requirement |
|---|---|
| FR-38 | If no plugins and `use()` never called → thin path: current commit behavior + `lastEmitted` (no registry/notify overhead) |
| FR-39 | First plugin registration promotes to full plugin runtime for instance lifetime |

---

## 5. Frozen TypeScript contract

Normative for implementation and public exports (root and/or `./plugin`).

```ts
// ── Meta ──────────────────────────────────────────────────

type EditorCommitKind =
  | 'set-value'
  | 'rename'
  | 'type-change'
  | 'add'
  | 'delete'
  | 'clear'
  | 'duplicate'
  | 'reorder'
  | 'external'
  | 'plugin'
  | 'unknown';

type EditorCommitOrigin = 'ui' | 'host' | 'plugin';

type EditorCommitMeta = {
  origin: EditorCommitOrigin;
  kind: EditorCommitKind;
  path?: JsonPath;
  coalesceKey?: string;
  skipHistory: boolean;
  echo: boolean;
};

// ── Transaction (document only) ───────────────────────────
// Exactly one of nextRoot | nextValue.

type EditorTransaction = {
  nextRoot?: unknown;
  nextValue?: string;
  meta: EditorCommitMeta;
};

// ── Snapshot ──────────────────────────────────────────────

type EditorStateSnapshot = {
  value: string;
  /** Display root: always a JSON object root for the tree (last-good when invalid). */
  root: JsonRootValue;
  validity: JsonValidity;
  readOnly: boolean;
};

// ── Event ─────────────────────────────────────────────────

type TransactionEvent = {
  tr: EditorTransaction;
  value: string;
  prevValue: string;
  didEmit: boolean;
  state: EditorStateSnapshot;
};

// ── Plugin ────────────────────────────────────────────────

type JsonTreeEditorPlugin = {
  name: string;
  setup(ctx: PluginContext): void | (() => void);
};

type RegisterCommandResult = {
  role: 'master' | 'subordinate';
  masterPluginName: string;
};

type RegisterCommandOptions = {
  exclusive?: boolean;
  onBecomeSubordinate?: (info: {
    command: string;
    masterPluginName: string;
  }) => void;
};

interface PluginContext {
  readonly pluginName: string;
  readonly contextVersion: 1;

  getState(): EditorStateSnapshot;
  getValue(): string;

  dispatch(tr: EditorTransaction): boolean;

  setValue(
    prettyOrRoot: string | unknown,
    meta?: Partial<
      Pick<EditorCommitMeta, 'kind' | 'path' | 'coalesceKey' | 'skipHistory'>
    >,
  ): boolean;

  onTransaction(cb: (e: TransactionEvent) => void): () => void;

  registerCommand(
    name: string,
    impl: (...args: unknown[]) => unknown,
    options?: RegisterCommandOptions,
  ): RegisterCommandResult;

  callCommand<T = unknown>(name: string, ...args: unknown[]): T | undefined;
  hasCommand(name: string): boolean;
}

type JsonTreeViewHandle = {
  getRoot: () => HTMLDivElement | null;
  use: (plugin: JsonTreeEditorPlugin) => () => void;
  callCommand: <T = unknown>(name: string, ...args: unknown[]) => T | undefined;
  hasCommand: (name: string) => boolean;
};
```

### 5.1 `getState().root` under invalid host value

Matches today’s tree: when `value` fails parse (or repair), **`root` is the display / last-good object root** used for rendering, not a throw. `validity` reflects parse status of `value`. Plugins editing via UI still mutate through the live tree root; emits replace host with valid pretty JSON.

### 5.2 Payload resolution

| Source | Field |
|---|---|
| UI commit | `nextRoot` only → core `stringifyJsonDocument` |
| Host value change | `nextValue` only (no re-stringify by core) |
| `setValue(string)` | `nextValue` |
| `setValue(non-string)` | `nextRoot` |
| Plugin normal apply | Prefer `nextRoot` |

---

## 6. Controlled value and `lastEmitted`

Core owns `lastEmitted: string | null`, set only when core calls `onChange`.

| Event | Core action | Plugin `onTransaction` | History (when present) |
|---|---|---|---|
| UI → new pretty | `onChange`, `lastEmitted = pretty` | yes, `didEmit: true`, `origin: 'ui'` | record unless `skipHistory` |
| UI → same string | no-op | no | — |
| Plugin dispatch → new | emit path as UI | yes, `didEmit: true` usually | honor `skipHistory` |
| Host `value === lastEmitted` | parse/sync only (**echo**) | **no** | skip |
| Host `value !== lastEmitted` | adopt string | yes, `origin: 'host'`, `kind: 'external'`, `didEmit: false` | record (policy A), clear redo |
| First mount | baseline; `lastEmitted = null` | **no** phantom external | no phantom step |
| `readOnly` | reject | no | — |

**WC without host round-trip:** still sets `lastEmitted` on emit; subsequent host sets compare to `lastEmitted` normally.

**WC bridge:** single `lastEmitted` in shared runtime — WC must not invent a second echo layer.

---

## 7. Lifecycle

### 7.1 Solid

```tsx
const plugins = [historyPlugin({ maxDepth: 100 })]; // stable

<JsonTreeView value={json} onChange={setJson} plugins={plugins} ref={setHandle} />
```

| Phase | Behavior |
|---|---|
| Mount | Thin or full runtime; register plugins in array order |
| `plugins` prop | By name: teardown removed, setup new; same name keeps instance |
| `use(plugin)` | Register; returns dispose |
| Unmount | Teardown reverse order / all |

### 7.2 Web component

```ts
el.use(historyPlugin());
// or
el.plugins = [historyPlugin()];
el.callCommand('undo');
```

Queue until Solid bridge/runtime exists. `disconnectedCallback` disposes plugins + registry.

---

## 8. Install recipes (history / collab) — normative examples

```ts
// A — recommended
plugins = [historyPlugin(), collabPlugin({ adapter: yjsAdapter(...) })]

// B — collab packages history
plugins = [collabPlugin({ packageHistory: true, adapter: ... })]

// C — sync only, no undo commands
plugins = [collabPlugin({ packageHistory: false, adapter: ... })]

// D — broken (exclusive clash / wrong master)
plugins = [collabPlugin(), historyPlugin()] // fix order or use B
```

Backend attach lives in the **history package**, e.g. `attachHistoryBackend(ctx, backend)`, not in core.

---

## 9. Migration plan

| Phase | Work | Host impact |
|---|---|---|
| P0 | `lastEmitted` + host value classification | Behavior-compatible |
| P1 | `commit` → `dispatch` + core meta on structural ops | Same `onChange` |
| P2 | Registry, `plugins`, handle methods, thin→full promote | Additive API |
| P3 | WC `use` / `plugins` / dispose | Additive |
| P4 | Tests, docs, CHANGELOG | — |
| P5 | History plugin (separate PRD/PR) | — |

**Compatibility:** `value` / `onChange` / `getRoot` / `readOnly` / `search` / `arrayReorder` / `defaultExpandedDepth` / pretty emit format **MUST** remain.

---

## 10. Success criteria (acceptance tests)

1. No-plugin demos/tests: same UX; dual-pane works.  
2. Echo: host sets `value` to last emit → no extra `onChange`; no plugin event.  
3. External: host sets different `value` + logging plugin → one `onTransaction` (`host` / `external` / `didEmit: false`).  
4. UI structural edit → plugin sees `didEmit: true`, `origin: 'ui'`, useful `kind`.  
5. Two plugins register `undo`; only first runs; exclusive second → `console.error`.  
6. Master teardown → `hasCommand('undo') === false`.  
7. `setValue` only goes through `dispatch` (instrumentation/unit test).  
8. Invalid tx shape → `false`, no emit.  
9. Thin path: no plugins → no registry listener cost on large-tree smoke.  
10. WC: pre-connect `use` works; disconnect teardowns.  
11. Stable `plugin.name` does not re-setup on parent re-render.  
12. Re-entrant `dispatch` from `onTransaction` flushes within depth limit.

---

## 11. Out of scope follow-ups (tracked, not this PRD)

- History plugin (LocalStack, coalesce sessions, Mod+Z, `readHistory` shape)  
- Collab Yjs/Loro adapters + presence + follow  
- `filterTransaction`  
- UI state subscriptions / transactions  
- Breadcrumb (core chrome)  
- Handle/WC `undo` wrappers  

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Keystroke path regression | Thin path; preserve StringEditor draft behavior; tests |
| Echo misclassification | Explicit `lastEmitted` table; dual-pane + WC tests |
| Stale plugin options | Document identity-by-name; no silent reconfigure |
| Broken exclusive installs | `console.error`; recipes A–D |
| Collab full-doc stringify cost | Accepted for foundation; revisit with adapters |
| Meta incomplete for strings | Structural ops first; coalesce with history PR |

---

## 13. Process notes

### Planner ↔ devil’s advocate

| Round | Outcome |
|---|---|
| v1 proposal | Full transaction + attach + UI txs + promote |
| Devil’s advocate | APPROVE WITH CHANGES — fatals on dual writes, UI bus, attach, etc. |
| v1.1 revised | Slim funnel, doc-only, thin path, history-owned attach |
| Final DA | **FREEZE WITH NITS** — nits folded into this PRD |

### Related docs

- `FUTURE.md` — backlog priority  
- `plans/plugin-system.md` — early notes (non-normative after this PRD)  
- `plans/history.md` — first consumer (update when implementing history)  
- `plans/collaboration-plugins.md` — second consumer  

---

## 14. Open items deferred (explicitly not freeze blockers)

1. Exact `HistorySnapshot` shape for `readHistory`  
2. Whether known-pair warning ships in foundation or history PR  
3. Package export path: types on root vs `@…/plugin` only  
4. Dev-only vs always-on `console.error` volume (normative: once per bad registration is enough)

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| Master | First registrant for a command name; sole `callCommand` target |
| Subordinate | Later registrant; does not serve callers |
| Thin path | Runtime without plugin registry when unused |
| Echo | Host wrote back the string core just emitted |
| Display root | Object root shown in the tree (last-good if invalid) |
| Trusted plugin | Same-privilege module; not sandboxed |

## Appendix B — Non-requirements restated

No ProseMirror schema, no plugin marketplace, no untrusted-plugin security model, no automatic reordering of plugins, no second document truth beside the host string for foundation.
