# Architecture: Plugin System Foundation

**Normative product requirements:** [PRD-plugin-system.md](./PRD-plugin-system.md) (v1.1 FREEZE)  
**Status:** architecture for implementation (P0–P4)

---

## 1. Design principles

1. **One funnel** — document writes enter only through `dispatch`.
2. **Thin by default** — no plugin overhead until a plugin exists.
3. **Host owns the string** — core emits pretty JSON; plugins never replace that contract.
4. **Core chrome stays core** — search, DnD, expand/focus are not plugins.
5. **Trusted plugins only** — no sandbox; isolate teardown errors.
6. **Framework-agnostic plugin modules** — same plugin object for Solid and WC.

---

## 2. System context

```
┌─────────────────────────────────────────────────────────────┐
│ Host app (Solid / React / Vue / vanilla)                      │
│  value: string  ·  onChange(pretty)  ·  plugins / use()       │
└───────────────┬──────────────────────────────▲────────────────┘
                │                              │
     ┌──────────▼──────────┐        ┌──────────┴──────────┐
     │ JsonTreeView (Solid)│        │ <json-tree-editor>  │
     │  or WC → Solid tree │        │  bridges props/events│
     └──────────┬──────────┘        └──────────┬──────────┘
                │                              │
                └──────────┬───────────────────┘
                           ▼
                ┌──────────────────────┐
                │  EditorRuntime         │
                │  · lastEmitted         │
                │  · dispatch            │
                │  · plugin host (lazy)  │
                │  · command registry    │
                └──────────┬─────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   parse / tree UI    onChange host    plugins.onTransaction
   (JsonTreeView)                      commands.callCommand
```

---

## 3. Module layout

```
json-tree-editor/src/
  lib/
    editor-runtime/
      types.ts              # EditorTransaction, PluginContext types (public re-export)
      create-editor-runtime.ts
      command-registry.ts
      plugin-host.ts        # setup/teardown, identity by name
      dispatch.ts           # apply tx, lastEmitted, queue, notify
      meta.ts               # helpers to build EditorCommitMeta for UI ops
      index.ts
    parse-json.ts           # existing — displayRoot / validity
    json-path.ts            # existing — pathKey for coalesceKey
  components/primitives/
    JsonTreeView.tsx        # owns UI state; uses runtime for commits
  web-component.tsx         # plugins / use / callCommand bridge
  plugin.ts                 # public export surface for types (+ definePlugin)
  index.ts                  # re-export plugin types from root
```

**Optional export map:**

```json
"./plugin": { "types": "./src/plugin.ts", "import": "./src/plugin.ts", ... }
```

Keep runtime **internal** (not a public deep import) unless tests need `@internal` access via package source.

---

## 4. Runtime API (internal)

```ts
type EditorRuntime = {
  /** Current host value as runtime sees it (mirrors props). */
  getValue(): string;
  getSnapshot(): EditorStateSnapshot;

  /**
   * Thin path: commit from UI without plugin notify.
   * Full path: dispatch with meta + notify.
   */
  dispatch(tr: EditorTransaction): boolean;

  /** UI helper: dispatch nextRoot with origin ui + kind/path/coalesce. */
  commitUi(nextRoot: unknown, partial: Partial<EditorCommitMeta>): boolean;

  /** Host value prop changed (Solid effect / WC setValue). */
  handleHostValue(next: string): void;

  setReadOnly(ro: boolean): void;
  setOnChange(fn: (pretty: string) => void): void;
  setRootProvider(fn: () => JsonRootValue): void; // display root from view
  setValidityProvider(fn: () => JsonValidity): void;

  // Plugin host (no-ops / lazy-create on first use)
  setPlugins(plugins: JsonTreeEditorPlugin[]): void;
  use(plugin: JsonTreeEditorPlugin): () => void;
  callCommand<T>(name: string, ...args: unknown[]): T | undefined;
  hasCommand(name: string): boolean;

  dispose(): void;
};

function createEditorRuntime(options: {
  initialValue: string;
  onChange: (pretty: string) => void;
  readOnly?: boolean;
}): EditorRuntime;
```

### 4.1 Thin vs full

| Mode | When | Behavior |
|---|---|---|
| **Thin** | no plugins ever registered | `commitUi` → stringify → lastEmitted → onChange; host echo silent; **no** plugin list |
| **Full** | first `use` / non-empty `setPlugins` | create `PluginHost` + `CommandRegistry`; all doc applies notify `onTransaction` (except echo) |

Promotion is one-way for the instance lifetime (PRD).

### 4.2 Dispatch algorithm (full path)

```
dispatch(tr):
  if readOnly → return false
  if not exactly one of nextRoot|nextValue → return false

  prevValue = currentValue
  if nextRoot defined:
    nextString = stringifyJsonDocument(nextRoot)  // may throw — do not catch silently
  else:
    nextString = nextValue

  if nextString === prevValue && !isHostExternalBaseline:
    return false  // pure no-op

  // Host external / echo handled in handleHostValue, not always via dispatch

  currentValue = nextString
  didEmit = false
  if shouldEmit(tr):  // origin ui|plugin and not skip that skips emit… normal: emit
    lastEmitted = nextString
    onChange(nextString)
    didEmit = true

  if pluginHost:
    notify onTransaction({ tr, value, prevValue, didEmit, state: snapshot() })
    flushDispatchQueue()  // re-entrant dispatches, depth ≤ 8

  return true
```

**Host path (`handleHostValue`)** — separate from UI for clarity:

```
handleHostValue(next):
  if next === lastEmitted:
    // echo: update internal value baseline + parse only; NO onTransaction
    currentValue = next
    return
  if next === currentValue:
    return
  // external
  prev = currentValue
  currentValue = next
  if pluginHost:
    notify onTransaction({
      tr: { nextValue: next, meta: { origin:'host', kind:'external', skipHistory:false, echo:false } },
      value: next, prevValue: prev, didEmit: false, state
    })
    flushQueue()
```

First mount: set `currentValue`, leave `lastEmitted = null`, **no** external event.

### 4.3 Command registry

```
Map<commandName, { masterPluginName, impl }>
// subordinates not stored as fallback

register(pluginName, command, impl, opts):
  if command free → master
  else → subordinate; opts.onBecomeSubordinate?; if exclusive → console.error once

unregisterPlugin(pluginName):
  delete all commands where masterPluginName === pluginName
  // no promote
```

### 4.4 Plugin host

```
Map<name, { plugin, dispose?: () => void }>

setPlugins(list):
  // teardown names not in list
  // setup names not yet present (in list order)
  // existing names: keep instance (ignore new object options)

use(plugin):
  promote full if needed
  if name exists → console.error skip OR replace? PRD: unique name, skip second setup
  setup(createContext(name))
  return () => teardown(name)
```

`PluginContext` closes over `runtime` + `pluginName`.

---

## 5. Integration with `JsonTreeView`

### 5.1 State ownership split

| State | Owner |
|---|---|
| `value` (prop) | Host |
| `lastEmitted`, dispatch, plugins | **EditorRuntime** |
| `focusedPathKey`, expanded set, search UI | **JsonTreeView** (private) |
| `displayRoot` / validity | View derives via `parseJsonSource(props.value)` as today; runtime snapshot providers read from view |

### 5.2 Commit migration

```ts
// before
const commit = (nextRoot: unknown) => {
  if (props.readOnly) return;
  emitPretty(nextRoot, props.onChange);
};

// after
const commit = (nextRoot: unknown, meta?: Partial<EditorCommitMeta>) => {
  runtime.commitUi(nextRoot, {
    kind: meta?.kind ?? 'unknown',
    path: meta?.path,
    coalesceKey: meta?.coalesceKey,
    // origin ui, skipHistory false, echo false filled by runtime
  });
};
```

Thread meta from `JsonTreeNode` for structural ops where path is known (follow-up within P1 if too large — minimum: `kind` on node-level ops).

### 5.3 Host value effect

```ts
createEffect(() => {
  const v = props.value;
  runtime.handleHostValue(v);
});
```

Avoid double work with parse effect — either parse stays view-only and runtime only tracks string, or runtime owns string and view reads `runtime.getValue()`. **Recommendation:** view keeps parse on `props.value` (React-like controlled); runtime tracks string equality for echo only.

### 5.4 Handle

```ts
assignRef(props.ref, {
  getRoot: () => rootEl,
  use: (p) => runtime.use(p),
  callCommand: (n, ...a) => runtime.callCommand(n, ...a),
  hasCommand: (n) => runtime.hasCommand(n),
});
```

### 5.5 Props

```ts
plugins?: JsonTreeEditorPlugin[];
```

`createEffect` on plugin name list → `runtime.setPlugins(props.plugins ?? [])`.

---

## 6. Web component bridge

```
#queuedPlugins: JsonTreeEditorPlugin[] | null
#runtime access via bridge after Solid mount

use(plugin):
  if !bridge: queue
  else: return bridge.use(plugin)

plugins setter:
  store array; bridge?.setPlugins(array)

disconnectedCallback:
  dispose queued + bridge runtime plugins (Solid unmount already dispose view)
```

Pass `plugins` into `JsonTreeView` as prop from WC signals so one registration path.

Expose `callCommand` / `hasCommand` on element.

---

## 7. Testing architecture

| Layer | File | Covers |
|---|---|---|
| Unit | `lib/editor-runtime/*.test.ts` | dispatch XOR, echo, external, registry master/subordinate, exclusive error, teardown, re-entry depth, thin vs full |
| Integration | `JsonTreeView.plugins.test.tsx` | UI edit → onTransaction; plugins prop identity; handle.use |
| WC | light unit on queue/dispose if feasible; else bridge tests via Solid |

Acceptance criteria map 1:1 to PRD §10.

---

## 8. Implementation phases (engineering)

### P0 — lastEmitted + host classification
- `createEditorRuntime` minimal (no plugins)
- Wire `handleHostValue` + `commitUi` thin
- JsonTreeView uses runtime for commit + value effect
- Tests: echo / external (no plugins)

### P1 — meta on structural commits
- `commitUi` meta from JsonTreeNode ops (kind + path)
- `unknown` fallback for untagged paths

### P2 — plugin host + commands
- Full promote, registry, context, `plugins` prop, handle methods
- Tests: FR registry + onTransaction + setValue sugar

### P3 — WC surface
- use / plugins / callCommand / disconnect

### P4 — docs + CHANGELOG + export `./plugin`
- Link PRD; update FUTURE.md status for foundation when shipped

**Do not** implement history in these phases.

---

## 9. Dependency rules

```
JsonTreeView → editor-runtime → parse-json, json-path (stringify only via parse-json)
plugin authors → public types only (no import of createEditorRuntime)
web-component → JsonTreeView + types
history (future) → public Plugin types + attach helper in history module
```

No dependency from runtime → Solid components (runtime is plain TS).

---

## 10. File-level PR checklist

- [ ] `lib/editor-runtime/*` + unit tests  
- [ ] `JsonTreeView.tsx` integration  
- [ ] `JsonTreeView.plugins.test.tsx`  
- [ ] `web-component.tsx` API  
- [ ] `plugin.ts` + `index.ts` + `package.json` exports  
- [ ] README snippet: plugins, recipes A–D pointer  
- [ ] CHANGELOG Unreleased  

---

## 11. Future architecture (not foundation)

```
historyPlugin
  └─ LocalStack | attachHistoryBackend(Yjs|Loro)

collabPlugin
  └─ adapter sync → dispatch/setValue with skipHistory as needed
  └─ awareness (presence) separate from document funnel
```

Keyboard Mod+Z: history plugin binds via host `getRoot()` or a later context DOM helper — not foundation.
