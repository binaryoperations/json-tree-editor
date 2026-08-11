# Breadcrumb / Path Bar — Implementation Plan

> Status: planned (not started). Companion to [FUTURE.md](../FUTURE.md).

## Current state (findings)

### Focus / “current node”
There is **no separate selection model**. `JsonTreeView` keeps a single internal roving-tabindex key:

- `focusedPathKey: string` (via `pathKey(path)`, root = `ROOT_PATH_KEY` / `''`)
- Updated by: row click/focus-in, arrow navigation, search `revealPath`, DnD `onFocusPath`
- Tree rows use `data-path={pathDomId(path)}` (`JSON.stringify(path)`) and `tabIndex` 0/-1

**Implication:** Breadcrumbs should track **focus**, not invent a second selected path. Search already moves focus; breadcrumbs and search stay aligned for free.

### Path utilities (`lib/json-path.ts`)
Already available: `JsonPath`, `pathKey` / `ROOT_PATH_KEY`, `getAtPath`, `pathDomId`, `collectVisiblePaths`.  
`ancestorPathKeys` lives in `search.ts`.

**Missing:** display formatting (labels, separators, empty-key rendering). Tree UI uses `keyLabel="root"` for root — breadcrumbs should match.

### Public API today
**Solid `JsonTreeView`:** `value`, `onChange`, `defaultExpandedDepth`, `arrayReorder`, `readOnly`, `search`, `ref` (`getRoot()` only).  
**WC:** same + `change` / `json-change`. No path events.

### Search navigation (pattern to reuse)
1. Expand ancestors (`expandPathKeys(ancestorPathKeys(path))`)
2. Double `requestAnimationFrame` for layout
3. `focusPath` / `revealPath` → set focus key, sticky-aware scroll

Breadcrumb clicks should use the **same** reveal pipeline.

---

## UX design

### Placement
Always show a path bar **above the tree scroller**, below error banner and find bar (when open). Always-visible chrome, not inside the sticky scroll region.

### What it shows
| Segment | Label | Style cue |
|---|---|---|
| Root | `root` | root key color |
| Object key | raw key string | key color |
| Array index | `0`, `1`, … | index color |

Separators: `›` (not JSONPath dots — dots break keys that contain `.`).

Example: `root › meta › author › email`

### Click behavior
- Root / intermediate segments → navigate (expand ancestors, focus, scroll)
- Current (last) segment → non-interactive, `aria-current="location"`
- Do **not** collapse descendants on click
- After navigate, focus moves into the tree row (arrow keys continue from there)

### Empty / long paths
- Root focus: single `root` segment (bar always visible)
- **v1:** horizontal overflow scroll (no middle-ellipsis)
- Optional tooltip with full label

### Prop
```ts
breadcrumb?: boolean; // default true
```

---

## Data model

Source of truth: **focus path** (prefer migrating internal state to `focusedPath: JsonPath` instead of key-only).

```ts
type BreadcrumbSegment = {
  path: JsonPath;
  label: string;
  kind: 'root' | 'key' | 'index';
  current: boolean;
};
```

Clamp invalid/stale paths with `clampPathToExisting`. Optional v1 notify: `onFocusedPathChange`; controlled focus deferred.

---

## Component design

### New: `TreeBreadcrumbBar`
Presentational: `segments` + `onNavigate(path)`.

### Helpers: `lib/path-display.ts`
- `pathToBreadcrumbSegments`
- `displayKeyLabel` (empty key → `""`)
- `clampPathToExisting`

### Wire in `JsonTreeView`
- Prop default on
- `navigateToPath` reuses expand + `focusPath`
- WC: `breadcrumb` attr, optional `focus-path-change` event
- `::part`: `breadcrumb`, `breadcrumb-segment`

---

## Accessibility
- `nav` + `aria-label="JSON path"`
- Segment buttons; separators `aria-hidden`
- Outside `role="tree"`
- After navigate: focus the treeitem

---

## Edge cases
Array indices (keep number type), empty keys, special chars, deep paths (scroll), delete/rename stale focus (clamp), document replace, read-only (nav still works), search jumps update bar.

---

## Testing
- Unit: path-display / clamp
- Integration: `JsonTreeView.breadcrumb.test.tsx` (render, click navigate, hide prop, clamp after delete, array indices)

---

## File changes

### New
- `TreeBreadcrumbBar.tsx`
- `lib/path-display.ts` + tests
- `JsonTreeView.breadcrumb.test.tsx`

### Touch
- `JsonTreeView.tsx`, `styles.css`, `web-component.tsx`, README, CHANGELOG, FUTURE.md

---

## Implementation order
1. Path helpers + unit tests  
2. UI component + styles  
3. Wire into `JsonTreeView` + integration tests  
4. WC + docs  
5. Polish (tooltips, optional focus event)

---

## Open questions
1. Default on or off? → **on**
2. Root label: `root` vs `$`? → **`root`**
3. Separator: `›` vs `/`? → **`›`**
4. Emit focus-path events in v1? → **yes, lightweight**
5. Empty key label? → **`""`**
6. Click collapse/zoom? → **no**
7. Hide at root? → **always visible**
8. Long path: scroll vs middle collapse? → **scroll v1**
9. Store focus as `JsonPath`? → **yes**
