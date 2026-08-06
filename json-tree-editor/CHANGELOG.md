# Changelog

All notable changes to `@binaryoperations/json-tree-editor` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **Moved** these exports from `@binaryoperations/json-tree-editor/utils` to `@binaryoperations/json-tree-editor/dnd`:
  - `HTML5_ARRAY_REORDER`
  - `createHtml5ArrayReorderParent`, `createHtml5ArrayItemUi`
  - Reorder types (`ArrayReorderController`, `ArrayReorderBinding`, `ArrayDragState`, …)
- **Deleted**
  - `NOOP_ARRAY_REORDER`
  - `resolveArrayReorderController`
  - `ARRAY_REORDER_HANDLE_SELECTOR`
  - `expandAll` / `collapseAll` / `isExpanding` on Solid `ref` and the web component
  - Props `onExpand`, `onExpandProgress`, `onCollapse`
  - Events `expand`, `collapse`, `expand-progress`
  - Type `ExpandProgress`
- Solid **`arrayReorder` default is off** (`undefined` / `false`). Pass a controller from `/dnd` to enable. Web component still enables HTML5 DnD by default.

### Refactor

- Split HTML5 DnD into `/dnd` so the core Solid entry can omit drag-and-drop code.
- `arrayReorder` is reactive (toggle without remounting the tree).
- Expand / collapse toolbar buttons enable from live expand state (not only structure).
- Removed global expand-all / collapse-all; use per-container expand / collapse on open objects and arrays.
- Web component: `arrayReorder` property / `array-reorder` attribute (default on).
- Solid **`readOnly`** prop on `JsonTreeView` (browse/expand still work; no mutations). Web component: property `readOnly` / attribute `readonly`.

### New Exports

From `@binaryoperations/json-tree-editor/dnd`:

- `HTML5_ARRAY_REORDER`, `createHtml5ArrayReorderParent`, `createHtml5ArrayItemUi`
- Reorder types
- `moveArrayItemAtPath`, `moveArrayItemByDelta`, `arrayDropTargetIndex` (also still on `/utils`)

From `@binaryoperations/json-tree-editor/utils`:

- `collectChildContainerPaths`, `collectDescendantContainerPaths` (and related path helpers)

## [1.0.6] - 2026-08-06

### Added

- **Reorder array items** by dragging the handle on each item.
- **Disable or replace reorder** with the `arrayReorder` prop on `JsonTreeView`.
- **Expand / collapse** nested children from the toolbar inside each open object or array (**+ key** / **+ item** and **clear** stay on the right).
- **Friendlier source parsing**: still accepts normal JSON, and also things like `{ a: 1 }`, `{ a: 1, }`, and `[1, 2,]`. `new Date(...)` becomes an ISO date string. Functions and similar non-JSON values are rejected.

### New Exports

From `@binaryoperations/json-tree-editor/utils`:

- `HTML5_ARRAY_REORDER`, `NOOP_ARRAY_REORDER`, `resolveArrayReorderController`
- `createHtml5ArrayReorderParent`, `createHtml5ArrayItemUi`, `ARRAY_REORDER_HANDLE_SELECTOR`
- `ArrayDragEdge`, `ArrayDragState`, `ArrayReorderBinding`, `ArrayReorderParentContext`, `ArrayReorderParent`, `ArrayItemReorderUi`, `ArrayReorderController`
- `moveArrayItemAtPath`, `moveArrayItemByDelta`, `arrayDropTargetIndex`
- `collectChildContainerPathKeys`, `collectSubtreeContainerPathKeys`
- `stringifyJsonDocument`, `assertJsonData`
- `isJsonContainer`, `dateToJsonString`

## [1.0.5] - 2026-08-02

### Added

- **Imperative expand API** on Solid `ref` and the web component: `expandAll()`, `collapseAll()`, `isExpanding()`, and `getRoot()` (returns the `.json-tree` element).
- **Expand lifecycle callbacks / events**: progress while expanding, and one-shot completion for expand and collapse (full expanded key list on completion).
- **`defaultExpandedDepth`** (default `0` = root open only) for Solid and the web component (`default-expanded-depth`), so hosts set initial open depth without knowing internal path keys.

### Changed

- **`JsonTreeView` owns parsing**: pass `value` (JSON string) instead of a precomputed `validity` object; the tree runs `parseJsonSource` internally.
- **Package entry split**: root export is only `JsonTreeView` (+ handle/types). Helpers, parse utilities, and primitives live under `@binaryoperations/json-tree-editor/utils`.
- **Type UI**: removed the separate type badge; the type `<select>` is badge-styled (one control per row, fewer DOM nodes on large trees).
- **Publish packaging**: optional `solid-js` peer for web-component-only installs; pack strips monorepo-only `package.json` fields with a restorable backup.
- **expandAll pacing**: fixed-size rAF chunks (one apply per frame) so the UI can paint between batches without multi-second freezes.

### Fixed

- Expand/collapse methods remain available when the control is `disabled` (pointer edits stay blocked).

## [1.0.3] - 2026-08-02

### Added

- First cut of expand/collapse-all surface and depth-based expand defaults (superseded and polished in 1.0.5).

### Changed

- Document parsing moved into `JsonTreeView` (`value` prop) so hosts no longer pass parse results into the tree.

## [1.0.2] - 2026-08-02

### Added

- **`/utils` package export** for path helpers, parsing, and lower-level primitives.
- Safer **publish flow** for the web-component build and consumer-facing package metadata.

## [1.0.1] - 2026-08-02

### Added

- **Root document rules**: blank input becomes a valid empty object; root must be object or array; invalid roots show an error while keeping a usable tree (last good or empty object).
- **Null editor**: focus/click `null` to type free text; JSON, number, or string is inferred; empty keeps `null`.
- **Duplicate** for non-root objects and arrays (deep clone as next sibling).
- **Container toolbar row**: `+ key` / `+ item`, **duplicate**, and **clear** inside expanded objects/arrays.
- **Smarter type conversion**: new objects/arrays seed one entry; primitives wrap into that entry when converting to object/array; string → `""`, boolean → `false`.
- **Shape cloning** for new siblings: arrays always seed a single item (not full length copy).
- **Vitest** coverage for path helpers, parse rules, editors, and tree behaviors.

### Changed

- Tree edits emit pretty JSON **without trailing whitespace**.
- Root type select limited to object/array.

## [1.0.0] - 2026-08-02

### Added

- Initial public release of `@binaryoperations/json-tree-editor`.
- **Solid** tree editor: collapsible JSON tree with key/value/type editing.
- **Web component** `<json-tree-editor>` with bundled Solid for non-Solid hosts.
- Keyboard navigation (ARIA tree-style arrows), theming via CSS variables and `::part`.
- Demo apps including a large-tree stress page.

---

[1.0.6]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.3...v1.0.5
[1.0.3]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/binaryoperations/json-tree-editor/releases/tag/v1.0.0
