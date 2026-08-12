# Plugin system & editor state — backlog notes

> Status: **highest priority foundation** — backlog notes, not a full design. Companion to [FUTURE.md](../FUTURE.md).  
> Related: [history.md](./history.md), [collaboration-plugins.md](./collaboration-plugins.md), [breadcrumb.md](./breadcrumb.md).

## Goals

1. **Plugin system** — features register instead of hard-wiring into the core tree.
2. **Editor state** — core owns a central surface (document, focus path, expand set, read-only, …) and a transaction/update path.
3. **Plugin-owned state** — plugins keep private state (undo stacks, CRDT docs, presence, …); core does not know those details.
4. **Command registry** — shared named commands (`undo`, `redo`, `goTo`, …) with a consistent conflict rule when more than one plugin claims the same name.

Registration should work on both Solid `JsonTreeView` and the web component (`use(plugin)` / `plugins` array).

---

## Master / subordinate registration rule

### Rule

For any **named capability or command**:

| Role | Who | Behavior |
|---|---|---|
| **Master** | First registrant | Owns the public API. Callers always invoke the master. |
| **Subordinate** | Later registrant(s) for the same name | Does **not** replace the master. May attach as backend/delegate **if the master allows**, or stay passive. |

This applies to **any** overlapping plugins (history, collab, clipboard, go-to, etc.), not only history.

### Rationale vs alternatives

| Strategy | Problem |
|---|---|
| **Last-wins** | Silent takeover; host load order flips behavior without a clear owner. |
| **Throw on second** | Blocks legitimate composition (e.g. collab supplying a CRDT undo backend under a history master). |
| **Master / subordinate** | Stable public API; composition is explicit and opt-in on the master’s terms. |

First-wins for **ownership**, not “first implementation forever with no extension.” Subordinates can still contribute when the master exposes a backend or delegate slot.

### Example: history + collab

History and collab are **separate concerns** but may both care about undo.

Ideal composition:

```
HistoryMaster (owns undo / redo / canUndo / canRedo / readHistory)
  └── backend: LocalStack | YjsUndo | LoroUndo
```

- Host loads **history only** → history is master; default local stack backend.
- Host loads **history then collab** → history stays master; collab may register as subordinate and offer a CRDT backend if history accepts it.
- Host loads **collab only**, and collab packages history → collab’s history registration is first → collab-supplied history is master (still the same public commands).
- Host loads **collab then a standalone history** → collab (or its packaged history) is master; standalone history is subordinate and must not steal the public API.

Same public history commands in every case. See [history.md](./history.md) and [collaboration-plugins.md](./collaboration-plugins.md).

---

## History master + pluggable backend (ideal)

Prefer **one history master** with a swappable backend rather than two competing undo stacks.

```ts
// Conceptual — not implemented
type HistoryBackend =
  | { kind: 'local-stack'; /* … */ }
  | { kind: 'yjs-undo'; /* … */ }
  | { kind: 'loro-undo'; /* … */ };

// History master owns commands; backend implements the mechanics.
```

| Backend | Typical source |
|---|---|
| `LocalStack` | Standalone history plugin (snapshots / stack) |
| `YjsUndo` | Yjs collab adapter (subordinate or packaged) |
| `LoroUndo` | Loro collab adapter (subordinate or packaged) |

Backend hot-swap should be supported when the master allows it (e.g. connect collab mid-session and switch from local stack to CRDT undo). Details deferred to a full design pass.

---

## History command API sketch

Public commands (conceptual; registry names):

| Command | Signature (sketch) | Role |
|---|---|---|
| `undo` | `() => boolean` | Revert one step |
| `redo` | `() => boolean` | Re-apply one step |
| `canUndo` | `() => boolean` | Whether undo is available |
| `canRedo` | `() => boolean` | Whether redo is available |
| `readHistory` | `() => HistorySnapshot` | Inspect history for UI / debugging |

Callers (keyboard shortcuts, toolbar, host app) always go through the registry → **master** implementation.

---

## PluginContext sketch

```ts
// Conceptual — not implemented
type CommandRole = 'master' | 'subordinate';

interface RegisterCommandResult {
  role: CommandRole;
  /** Present when role === 'subordinate'; the current master for this name. */
  master?: CommandHandle;
}

interface PluginContext {
  // Editor surface (sketch)
  getValue(): string;
  setValue(value: string, meta?: unknown): void;
  onTransaction?(cb: (tx: unknown) => void): () => void;

  /**
   * Register a named command.
   * First registrant becomes master; later ones become subordinate.
   */
  registerCommand(
    name: string,
    impl: CommandImpl,
    options?: {
      /** Called if this registration ends up subordinate. */
      onBecomeSubordinate?: (master: CommandHandle) => void;
      exclusive?: boolean; // if true and not master → warn (see defaults)
    },
  ): RegisterCommandResult;

  // Optional: master may expose attach points
  // e.g. history master: registerHistoryBackend(backend)
}

interface JsonTreeEditorPlugin {
  name: string;
  setup(ctx: PluginContext): void | (() => void);
}
```

### `onBecomeSubordinate`

When a plugin intends to own a command but arrives second, `onBecomeSubordinate` lets it:

- Offer itself as a backend/delegate to the master, or
- Disable its public command surface and stay passive.

Masters that support backends should document how subordinates attach.

---

## Registration surface (Solid + web component)

```ts
// Conceptual — not implemented

// Solid
<JsonTreeView
  value={json}
  onChange={setJson}
  plugins={[historyPlugin(), collabPlugin({ adapter: 'yjs' })]}
/>

// or imperative
const view = /* handle */;
view.use(historyPlugin());

// Web component
editor.use(historyPlugin());
editor.plugins = [historyPlugin(), collabPlugin({ adapter: 'loro' })];
```

**Plugins array order = register order.** First in the array is first registrant for any commands it claims.

---

## Design defaults

| Topic | Default |
|---|---|
| Owner / contributor labels in public docs | **Optional** — useful for debugging, not required in v1 API |
| Backend hot-swap | **Yes** when master supports it |
| `plugins` array order | **Register order** (first = master candidate) |
| Exclusive command (`exclusive: true`) but not master | **Warn** (console); do not throw by default |
| Last-wins | **No** |
| Throw on second registration | **No** (prefer subordinate + warn if exclusive) |

---

## Non-goals (this note)

- Full plugin marketplace or discovery
- Stable semver of every context method (version the context later)
- Implementing history or collab here — only the extension model

---

## Status

Highest-priority foundation for the backlog. These are **architectural notes**, not an implementation plan with file lists and tests. Next step when ready: a dedicated design pass that freezes `PluginContext`, command names, and the history-backend interface, then implement registry + history plugin before collab.
