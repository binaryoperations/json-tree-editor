# Collaboration, plugins & follow-user — notes

> Status: **high interest** — backlog only (not planned in depth). Companion to [FUTURE.md](../FUTURE.md).  
> Foundation: [plugin-system.md](./plugin-system.md). History API & ownership: [history.md](./history.md).

## Goals

1. **RT collaboration** with **Yjs** and **Loro** — both first-class as **adapter plugins**.
2. **Plugin API** on the web component (and Solid surface) so collab and future features don’t hard-wire into core — see [plugin-system.md](./plugin-system.md).
3. **History as a separate concern** — collab does not own the only definition of undo; it composes via master/subordinate (below).
4. **Follow another user** — presence + viewport/focus tracking, built on collab awareness.

## Separation of concerns

| Concern | Owner |
|---|---|
| Document editing UI | Core editor |
| Undo / redo public API | History **command master** (`undo`, `redo`, `canUndo`, `canRedo`, `readHistory`) |
| Multiplayer sync / CRDT | Collab plugin + Yjs or Loro adapter |
| Presence / follow | Collab-adjacent (awareness) |

Collab and history must not be fused into one inseparable module in the architecture story. Install ergonomics may still **package** history with collab for convenience.

## Master / subordinate with history

Conflict rule (general): **first registrant is master**; later registrants are **subordinates**. Subordinates do not replace the master; they may attach as backend/delegate if the master allows. Full detail: [plugin-system.md](./plugin-system.md).

For collab specifically:

| Packaging | Result |
|---|---|
| Collab **packages/installs history** and registers first | Collab-supplied history is **master**; same public history commands |
| History plugin loads first; collab loads later | History stays **master**; collab is **subordinate** and may supply a **CRDT backend** (`YjsUndo` / `LoroUndo`) if history allows |
| Both try to own commands without backend attach | Master serves commands; subordinate stays passive (warn if exclusive) |

**Same public history commands** in all cases — callers never branch on “local vs collab undo.”

Ideal shape:

```
HistoryMaster
  └── backend: LocalStack | YjsUndo | LoroUndo   ← collab adapters plug in here
```

## Sketch (for a later design pass)

### Collaboration port

```ts
// Conceptual — not implemented
interface CollabAdapter {
  /** Bind to document; emit remote updates; accept local commits. */
  connect(options: CollabConnectOptions): CollabSession;
}

interface CollabSession {
  getValue(): string;
  onRemoteChange(cb: (value: string) => void): () => void;
  applyLocalChange(value: string, meta?: { path?: JsonPath }): void;
  awareness: AwarenessChannel; // peers, colors, focused paths
  /** Optional: expose CRDT-native undo for history master backend. */
  getHistoryBackend?(): HistoryBackend;
  destroy(): void;
}
```

- Host chooses **Yjs** or **Loro** adapter plugins (and their providers: WebSocket, WebRTC, etc.).
- Tree remains controlled/`value`+`onChange` oriented; adapter bridges CRDT ↔ string/JSON root.
- History integration: prefer pluggable backend under history master ([history.md](./history.md)); do not invent a second public undo API.

### Plugin registration

```ts
// Conceptual — not implemented
// Order matters: first registrant for a command name is master.
plugins={[
  historyPlugin(),                           // master for undo/…
  collabPlugin({ adapter: yjsAdapter() }), // subordinate; may attach YjsUndo
]}
```

Or collab-only install that packages history so the packaged history registers first.

`PluginContext.registerCommand` returns `{ role: 'master' | 'subordinate', master? }` — see [plugin-system.md](./plugin-system.md).

### Follow user

- Presence: `{ userId, name?, color, path: JsonPath, lastActive }` via awareness.
- UI: peer list / avatars; click “Follow”.
- While following: expand + focus + scroll to peer path (reuse search/breadcrumb reveal pipeline); stop on local edit or unfollow.
- Do not force-follow on every micro-move if noisy — throttle / path-level updates.

## Out of scope until design

- Provider choice (y-websocket, Hocuspocus, custom Loro sync, etc.)
- Auth / rooms / permissions
- Conflict UX beyond CRDT automatic merge
- Full plugin marketplace — only the extension points
- Exact shape of `HistoryBackend` for Yjs/Loro

## When ready

1. Land plugin API + command registry ([plugin-system.md](./plugin-system.md)).
2. Land history plugin + local backend ([history.md](./history.md)).
3. Dedicated collab design pass (Yjs + Loro adapters, backend attach, presence/follow) before coding.
