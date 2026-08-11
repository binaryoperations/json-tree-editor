# Collaboration, plugins & follow-user — notes

> Status: **high interest** — backlog only (not planned in depth). Companion to [FUTURE.md](../FUTURE.md).

## Goals

1. **RT collaboration** with **Yjs** and **Loro** — both first-class via adapters.
2. **Plugin API** on the web component (and Solid surface) so collab and future features don’t hard-wire into core.
3. **Follow another user** — presence + viewport/focus tracking, built on collab awareness.

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
  destroy(): void;
}
```

- Host chooses `YjsCollabAdapter` or `LoroCollabAdapter` (and their providers: WebSocket, WebRTC, etc.).
- Tree remains controlled/`value`+`onChange` oriented; adapter bridges CRDT ↔ string/JSON root.
- History: decide later whether local undo is CRDT-native, editor-stack, or both (see [history.md](./history.md)).

### Plugin API (web component first)

```ts
// Conceptual
interface JsonTreeEditorPlugin {
  name: string;
  setup(ctx: PluginContext): void | (() => void);
}

interface PluginContext {
  getValue(): string;
  setValue(value: string): void;
  onChange(cb: (value: string) => void): () => void;
  onFocusPathChange?(cb: (path: JsonPath) => void): () => void;
  // chrome slots, commands, etc.
  registerCollabAdapter?(adapter: CollabAdapter): void;
}
```

- WC: `editor.use(plugin)` or `plugins` property / register method.
- Solid: optional `plugins` prop or same imperative handle.
- Version the context so plugins can declare compatibility.

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

## When ready

Run a dedicated design/plan pass (similar to breadcrumb + history) before coding.
