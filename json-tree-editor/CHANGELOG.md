# Changelog

All notable changes to `@binaryoperations/json-tree-editor` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.5]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.3...v1.0.5
[1.0.3]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/binaryoperations/json-tree-editor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/binaryoperations/json-tree-editor/releases/tag/v1.0.0
