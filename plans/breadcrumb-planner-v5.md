# breadcrumb-planner-v5 — Concise plan (PRD + acceptance checklist)

Status: **superseded — historical**. Shipped as `@binaryoperations/json-tree-editor/breadcrumbs`;
see [the plugin README](../json-tree-editor/src/breadcrumbs/README.md) and
[PRD-plugin-system §4.4.1](./PRD-plugin-system.md) for what was actually built.

The shipped design deliberately drops most of the machinery below. Notably:

- **No host bridge / no `json-tree-breadcrumb:navigate` event / no timeout race.** The
  bar is plugin-rendered UI inside the tree, so it calls the view's own primitives
  (`json-tree.expandPath`, `json-tree.revealPath`) directly. Nothing crosses a host
  boundary, so there is nothing to bridge or time out.
- **`selectPath` is a plugin command, not core**, and takes the plain name `selectPath`
  (not `json-tree-breadcrumb:selectPath`) so a competing plugin registers as a
  subordinate under the existing master/subordinate rule.
- **No node identity work** (`nodeId`, bounded DFS `findPathForNodeId`). Crumbs address
  rows by `JsonPath`, which the view already keys on.
- **No `path-json` attribute** on the web component; the WC takes the plugin object,
  same as a Solid host.
- Segment clicks **reveal only** — scroll into view and flash a ring around the key.
  Retained from below: JsonPath as the canonical address, RFC 6901 pointer helpers,
  the WAI-ARIA mapping, and focus-driven (not selection-driven) tracking.

Original v5 notes follow.

Companion to plans/breadcrumb.md.

Summary (PRD block)
-------------------
Breadcrumbs expose a focus-driven path bar for JsonTreeView using JsonPath arrays as canonical addresses. Host integration prefers a host.selectPath adapter (Promise-based) with a robust event fallback (CustomEvent 'json-tree-breadcrumb:navigate'). Node identity supports stable nodeId/pointer and a bounded-search fallback. Accessibility follows explicit WAI-ARIA mapping (nav>ol>li>a, aria-current, popover/menu roles). No innerHTML by default; sanitizer opt-in. SelectPath is a Promise that resolves when the target node is visible. Provide pointer <-> JsonPath helpers (RFC6901) and tests, copy/share UI that emits RFC6901 JSON Pointer strings, multi-selection semantics, cache & subscription model, and performance benching with RAF batching.

Detailed items & code snippets
------------------------------
1) Host adapter for selectPath
- Host-first: call host.selectPath if present. Fallback: dispatch CustomEvent named `json-tree-breadcrumb:navigate`.

TS host bridge signature (web-component / runtime host):

```ts
// Web component bridge (extend existing HostBridge)
import type { JsonPath } from '../src/lib/json-path';

type SelectPathResult = { visible: boolean; path: JsonPath };

type HostBridge = {
  // existing...
  selectPath?: (
    path: JsonPath,
    opts?: { expand?: boolean; reveal?: boolean; focus?: boolean }
  ) => Promise<SelectPathResult>;
};
```

Fallback event (exact event type):

```ts
// Dispatch when host.selectPath absent
this.dispatchEvent(new CustomEvent('json-tree-breadcrumb:navigate', {
  bubbles: true,
  composed: true,
  detail: {
    path: JsonPath, // JsonPath array
    opts: { expand?: boolean; reveal?: boolean; focus?: boolean },
  }
}));
```

Plugin command name (runtime): `json-tree-breadcrumb:selectPath` — register via `ctx.registerCommand` in plugins.

Example plugin registration (use runtime.registerCommand / PluginContext.registerCommand already in repo):

```ts
ctx.registerCommand(
  'json-tree-breadcrumb:selectPath',
  async (path: JsonPath, opts?: { expand?: boolean; reveal?: boolean; focus?: boolean }) => {
    // canonical implementation: expand ancestors, double RAF, then revealPath + focusPath
    await expandAncestors(path, { via: 'breadcrumb' });
    await nextAnimationFrame();
    revealPath(path, { keepSearchFocus: !!opts?.focus });
    return { visible: Boolean(findTreeItem(path)), path } as SelectPathResult;
  },
  { exclusive: true }
);
```

2) Node-model requirements & fallbacks
- Primary requirement: nodes should expose either a stable `nodeId: string` or a `pointer: string` (RFC6901). If neither available, the runtime must provide `getPathForNodeId(nodeId)` via plugin/host command.
- Fallback: bounded DFS search with timeout (configurable; default 200ms). Use iterative DFS with yield points and time-check to avoid blocking UI.

Helper (bounded-search fallback):

```ts
export async function findPathForNodeId(
  root: unknown,
  nodeId: string,
  opts: { timeoutMs?: number } = { timeoutMs: 200 }
): Promise<JsonPath | null> {
  const start = performance.now();
  const stack: { value: unknown; path: JsonPath }[] = [{ value: root, path: [] }];
  while (stack.length) {
    if (performance.now() - start > (opts.timeoutMs ?? 200)) return null;
    const { value, path } = stack.pop()!;
    if (isObject(value) && (value as any).nodeId === nodeId) return path;
    // push children
  }
  return null;
}
```

Plugin hook: registerCommand('json-tree:getPathForNodeId', (id)=>Promise<JsonPath|undefined>)

3) Web Component attribute semantics
- Primary API: property-based. Attributes are secondary and limited to `path-json` (single attribute) which may hold either:
  - JSON-encoded JsonPath array: `["meta","author","email"]`
  - or JSON Pointer string: `/meta/author/email` (RFC6901)
- Parsing/serialization examples:

```ts
// parse attribute
function parsePathJsonAttr(raw: string | null): JsonPath | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v as JsonPath;
  } catch (_) {
    // fallthrough: allow pointer string literal
  }
  if (typeof raw === 'string' && raw.startsWith('/')) return jsonPointerToPath(raw);
  return null;
}

// serialize to attribute (prefer JSON array):
el.setAttribute('path-json', JSON.stringify(path));
// or pointer form
el.setAttribute('path-json', pathToJsonPointer(path));
```

Note: only a single attribute `path-json` is supported to avoid mixing APIs.

4) Concrete WAI-ARIA mapping
- DOM: nav[aria-label="JSON path"] > ol > li* > a
- Last segment: non-interactive but still in DOM; set `aria-current="true"` (or `aria-current="location"`).
- Popover (segment options) roles: `button` to open, content role `menu` or `dialog` depending on interaction complexity.
- Keyboard rules:
  - Left/Right: move previous/next segment (wrap optional)
  - Home/End: move to root / last
  - Enter/Space: activate (navigate)
  - Down/Up on a segment with menu: open popover and focus first/last menu item
- aria-live: use a polite region for announcements with debounce 300ms after navigation (to avoid spam). Example debounce helper:

```ts
const announce = debounce((msg: string)=> { liveRegion.textContent = msg; }, 300);
```

5) Cache invalidation & model-change hooks
- Cache key policy: cache keyed by `cacheKey = commitCounter + ':' + pathKey(rootPath)` where commitCounter increments on every transaction; simpler: use the EditorTransaction `tr.meta.coalesceKey` when present or a runtime-incremented `docVersion` updated on every apply.
- Subscription: runtime `ctx.onTransaction` (PluginHost.onTransaction) invalidates affected keys or entire breadcrumb cache when tree shape changes at/above cached paths.
- TTL fallback: entries expire after 5s if not invalidated.

Example subscriptions:

```ts
const unsub = ctx.onTransaction((e)=> {
  docVersion++;
  // compute minimal invalidation from e.tr.meta.path / newPath
  breadcrumbCache.invalidateForPath(e.tr.meta.path ?? []);
});
```

Tests: simulate transaction that renames/deletes node and assert cache recompute on next render.

6) Copy/share UI + JSON Pointer RFC6901 escapes + tests
- Implement utility helpers (RFC6901) in `src/lib/json-pointer.ts` (see #12). Copy action emits pointer form and writes to clipboard.

Escaping helpers:

```ts
export function pointerEscape(seg: string): string {
  return seg.replace(/~/g, '~0').replace(/\//g, '~1');
}
export function pathToJsonPointer(path: JsonPath): string {
  if (path.length === 0) return '';
  return '/' + path.map((s)=> pointerEscape(String(s))).join('/');
}
```

Tests: verify `['a/b','~tilde']` → `/a~1b/~0tilde` and clipboard content.

7) Security: escaping / no innerHTML default
- Default rendering uses textContent / createTextNode only. No innerHTML anywhere in breadcrumb rendering.
- Opt-in sanitizer: prop `sanitizeHtml?: (s: string) => string` and explicit `dangerouslyAllowHtml: boolean` flagged API.
- Test: render malicious label `<img src=x onerror=alert(1)>` and assert no script execution and that `innerHTML` not used.

8) Multi-selection semantics
- Model: `selection: Set<string>` keyed by `pathKey(JsonPath)`; `primarySelection: JsonPath | null` (= focused path).
- Behavior: primary selection always maps to the focused path. When multiple selected, breadcrumbs show primary label; optional UI `showSelectionCount?: boolean` toggles a small badge `+N` (exposed part `breadcrumb-selection-count`).

API example (props on JsonTreeView):

```ts
selection?: JsonPath[]; // controlled
onSelectionChange?: (paths: JsonPath[]) => void;
showSelectionCount?: boolean;
```

Tests: keyboard select multiple (Shift/Ctrl) and assert primary remains last-focused; breadcrumb count visible when option on.

9) selectPath contract (exact)
- Command name: `json-tree-breadcrumb:selectPath` (runtime) + host bridge `selectPath`
- TS signatures (canonical):

```ts
type JsonPath = (string|number)[];

// Host / runtime command
async function selectPath(
  path: JsonPath,
  opts?: { expand?: boolean; reveal?: boolean; focus?: boolean }
): Promise<{ visible: boolean; path: JsonPath }>;
```

Contract: if `expand` is true, expand ancestors; if `reveal` true, scroll into view; if `focus` true, focus the tree row; the returned Promise resolves after the row is present in the DOM and visible (not necessarily focused). If node not found (deleted) Promise resolves { visible: false, path: clampedPath } or rejects only on invalid args.

10) Performance measurement plan
- Bench fixtures under `demo/bench/` or `test/bench/`: large generated JSON (10k nodes), random deep paths, selection storms.
- Measure expand/reveal latency; record RAF batching savings.
- Implementation detail: batch multiple selectPath calls within the same frame into one expand+reveal using microtask/RAF coalescing.

Batching sketch:

```ts
let pendingSelect: {path: JsonPath; opts?: any} | null = null;
function scheduleSelect(p) {
  pendingSelect = p; // last-wins
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(()=>{
      const call = pendingSelect!;
      pendingSelect = null; scheduled = false;
      doSelect(call.path, call.opts);
    });
  }
}
```

11) Mobile bottom-sheet ARIA details
- On small viewports, breadcrumb overflow menu opens as bottom-sheet `role="dialog" aria-modal="true"`.
- Focus trap, close on backdrop tap or Escape, announce open/close via aria-live, provide `aria-label` and `data-action-close` target. Ensure scrollable content has `-webkit-overflow-scrolling: touch`.

12) Pointer <-> JsonPath helpers implemented and tested (RFC6901)
- Add `src/lib/json-pointer.ts` with `pathToJsonPointer(path: JsonPath): string` and `jsonPointerToPath(ptr: string): JsonPath` plus `pointerEscape` / `pointerUnescape`.
- Tests: `src/lib/json-pointer.test.ts` covering empty, numeric segments, special chars (`~` and `/`) per RFC6901.

Acceptance checklist
--------------------
- [ ] json-pointer helpers + tests (RFC6901 escape/unescape)
- [ ] Web component `path-json` attribute parsing/serialization examples in docs + tests
- [ ] Host bridge `selectPath` optional method added to HostBridge type & web-component implementation chooses host.selectPath first
- [ ] CustomEvent fallback `'json-tree-breadcrumb:navigate'` implemented and documented
- [ ] Runtime command `json-tree-breadcrumb:selectPath` registered; plugin tests using `ctx.registerCommand` exercising master/subordinate behavior
- [ ] NodeId / getPathForNodeId API proposal implemented with `ctx.registerCommand('json-tree:getPathForNodeId', ...)` and bounded search fallback + tests
- [ ] WAI-ARIA mapping implemented: nav>ol>li>a, aria-current, popover roles, keyboard rules + unit tests
- [ ] aria-live announcements debounced 300ms + test harness verifying announcements
- [ ] Breadcrumb caching with invalidation on ctx.onTransaction + TTL fallback + unit tests
- [ ] Copy/share UI produces JSON Pointer (RFC6901) and clipboard tests
- [ ] No innerHTML usage in breadcrumb renderer; sanitizer opt-in and tests
- [ ] Multi-selection semantics: primary selection defined + showSelectionCount option + tests
- [ ] selectPath contract: Promise resolves when node visible; test verifying expand/reveal + Promise behavior
- [ ] Performance bench fixtures and RAF batching for selection storms + benchmark report (PR)
- [ ] Mobile bottom-sheet ARIA details + tests
- [ ] Documentation: plans/breadcrumb.md & README web-component section updated with attribute/host adapter notes

Repository facts that remain blocking (short)
--------------------------------------------
- Host `selectPath` is not yet implemented in the web component HostBridge (blocking if host-level integration is required). Web component currently exposes callCommand/hasCommand/getRoot only (see `src/web-component.tsx`).
- There is no existing `json-pointer` helper file — need `src/lib/json-pointer.ts` + tests.
- There is no nodeId/getPathForNodeId convention in existing model — consuming plugins/hosts must adopt stable `nodeId` fields or register `json-tree:getPathForNodeId`.
- All other required hooks exist: `PluginContext.registerCommand` / `callCommand` / `onTransaction` and `JsonPath` type live in repo.

Notes on code alignment and file suggestions
-------------------------------------------
- Helpers: `src/lib/json-pointer.ts` (impl + tests);
- Breadcrumb UI: `src/components/primitives/TreeBreadcrumbBar.tsx` + `TreeBreadcrumbBar.test.tsx`;
- Wire: `src/components/primitives/JsonTreeView.tsx` (add prop wiring + selection-count parts);
- Web Component: extend HostBridge in `src/web-component.tsx` to include `selectPath?` and implement calling order (host.selectPath -> callCommand('json-tree-breadcrumb:selectPath') -> dispatch event fallback);
- Tests: reuse existing plugin test harnesses (`create-editor-runtime.test.ts` and `JsonTreeView.plugins.test.tsx`) to register/verify commands via `ctx.registerCommand`.

If you want, I can now: (A) open a PR draft with these file skeletons and tests, (B) implement `src/lib/json-pointer.ts` + tests, or (C) just land the plan file. Which should I do next?
