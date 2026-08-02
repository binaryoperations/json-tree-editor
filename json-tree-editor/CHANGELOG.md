# Changelog

All notable changes to `@binaryoperations/json-tree-editor` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-08-02

### Added

- expose expand/collapse APIs and defaultExpandedDepth

### Changed

- parse document source inside JsonTreeView

## [1.0.2] - 2026-08-02

### Added

- split utils export and harden publish package.json

## [1.0.1] - 2026-08-02

### Added

- move add and clear controls into container child rows
- duplicate non-root object and array nodes
- add editable null leaf with typed draft parsing
- seed new containers, tighten shape clone, quiet empty docs
- harden document root, tree UX, and add vitest coverage

## [1.0.0] - 2026-08-02

### Added

- shared header with left Popover drawer nav
- dual library surface — Solid entry + bundled web component

### Docs

- add package consumer README and restructure monorepo README

### Chore

- version scripts commit and tag library releases
- add version bump scripts for library package
- rename package to @binaryoperations/json-tree-editor
- add MIT license, npm metadata, and publish script
- relocate core project
- ship Solid as TS source; build only web-component
- drop unnecessary scripts

### Other

- Public WC export is only json-tree-editor/web-component
- Add ARIA tree-style keyboard arrow navigation
- Add expand/collapse all for large-tree demo
- Add large-tree stress demo (~5000 nodes)
- Initial scaffold: json-tree-editor library + demo

