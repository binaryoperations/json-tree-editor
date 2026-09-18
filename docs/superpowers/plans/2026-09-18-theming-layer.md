# Theming Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship first-class light/dark CSS presets (`default` + `high-contrast`) with `--jte--{block}--{modifier}` tokens, `light-dark()` + `color-scheme: light dark`, BEM type/value classes, and a complete `::part` map.

**Architecture:** Theme files assign tokens only. `styles.css` is structure + `@import` of default. Tokens use `light-dark()`. WC default lives on `:host`; Solid on `.json-tree:not(:host *)`. Hosts override tokens or `::part`. High-contrast is a second CSS file.

**Tech Stack:** CSS custom properties, `light-dark()`, `color-mix()`, Solid + WC (`styles.css?inline`), Vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-09-18-theming-layer-design.md` — token hex values and part names are copied from there. Do not invent extra public `--jte-*` names.

## Global Constraints

- Default scheme is `prefers-color-scheme` via `color-scheme: light dark` + `light-dark(light, dark)`. Light is not hardcoded default.
- Hosts force a side with `color-scheme: light` or `color-scheme: dark`.
- Token parse: split `--` → `--jte--{block}--{modifier}` (block may contain hyphens).
- No aliases for old `--jte-bg`, `--jte-string`, `--jte-type-string`, etc.
- Theme selectors: `:host, json-tree-editor, .json-tree:not(:host *)`. Never assign theme tokens on `.json-tree` inside the shadow.
- `styles.css` uses `var(--jte--…)` **without** dark hardcoded fallbacks.
- Keep `--jte-depth` as a **private indent** custom property on nodes (not a public theme token).
- `--jte--json-tree-value--{type}` defaults to `var(--jte--json-tree-type--{type})`.
- Type chips derive `-bg`/`-border` with `color-mix` unless the preset sets those tokens (high-contrast sets opaque).
- Parts: stem + extra variant names (`part="action delete"`). Search buttons must not be `action` only.
- File-disjoint commits: `git add -- <your files>` only. Never `git add -A`.
- Work on current branch `feat/plugin-system-foundation`. Do not switch branches.

## File map

| File | Role |
|---|---|
| `json-tree-editor/src/themes/default.css` | Default preset tokens |
| `json-tree-editor/src/themes/high-contrast.css` | High-contrast preset + 3px focus rules + opaque type chips |
| `json-tree-editor/src/styles.css` | `@import` default; structure; consume new tokens |
| `json-tree-editor/package.json` | exports `./themes/default.css`, `./themes/high-contrast.css` |
| Primitive editors + TypeSelect + HighlightText + TreeSearchBar + JsonTreeNode + JsonTreeView + BreadcrumbBar + flash-ring | BEM value modifiers + part map |
| `json-tree-editor/src/components/primitives/theming.test.tsx` | DOM tests for value class + parts |
| `demo/wc.html`, `demo/src/wc-main.ts`, Solid demos | scheme + high-contrast controls |
| README, CHANGELOG, breadcrumbs README | public docs |

## Old → new token map (structure CSS)

Replace every `var(--jte-X, fallback)` in `styles.css` with the new name and **no fallback**.

| Old | New |
|---|---|
| `--jte-bg` | `--jte--json-tree--bg` |
| `--jte-fg` | `--jte--json-tree--color` |
| `--jte-muted`, `--jte-muted-2`, `--jte-hint`, `--jte-select-fg`, `--jte-select-fg-hover` | `--jte--json-tree--muted` (hover can `color-mix` toward `--jte--json-tree--color`) |
| `--jte-border`, `--jte-border-strong`, `--jte-border-hover`, `--jte-surface-4` | `--jte--json-tree--border` (hover: `color-mix(in srgb, var(--jte--json-tree--border) 70%, var(--jte--json-tree--color))`) |
| `--jte-row-hover` | `--jte--json-tree-row--hover` |
| `--jte-row-focus-bg` | `--jte--json-tree-row--focus` |
| `--jte-surface`, `--jte-surface-2`, `--jte-surface-3` | `--jte--json-tree--surface` |
| `--jte-key` / `--root` / `--index` | `--jte--json-tree-key` / `--jte--json-tree-key--root` / `--jte--json-tree-key--index` |
| `--jte-string` / `--jte-number` / `--jte-boolean` / `--jte-null` | `--jte--json-tree-value--{type}` on `.json-tree-value--{type}` (not on input type classes) |
| `--jte-type-{t}` | `--jte--json-tree-type--{t}` |
| `--jte-type-{t}-bg` / `-border` | `--jte--json-tree-type--{t}-bg` / `-border` with color-mix fallback as spec |
| `--jte-flash-ring` | `--jte--json-tree-flash-ring` |
| `--jte-flash-bg` | `color-mix(in srgb, var(--jte--json-tree-flash-ring) 20%, transparent)` |
| `--jte-focus-ring`, `--jte-focus-border`, `--jte-focus-glow`, `--jte-focus-glow-soft` | `--jte--json-tree--focus` (glow: `color-mix(in srgb, var(--jte--json-tree--focus) 35%, transparent)`) |
| `--jte-mark-fg` / `--jte-mark-bg` | `--jte--json-tree-mark` / `--jte--json-tree-mark-bg` |
| `--jte-mark-active-fg` / `--jte-mark-active-bg` | `--jte--json-tree-mark--active` / `--jte--json-tree-mark--active-bg` |
| `--jte-search-active-row` | `--jte--json-tree-row--search-active` |
| `--jte-danger`, `--jte-danger-strong` | `--jte--json-tree-action--danger` |
| `--jte-error-fg`, `--jte-error-title`, `--jte-error-body` | `--jte--json-tree__error` |
| `--jte-error-bg` / `--jte-error-border` / `--jte-danger-bg` / `--jte-danger-border` | `--jte--json-tree__error-bg` / `--jte--json-tree__error-border` |
| `--jte-action-fg` | `--jte--json-tree-action` |
| `--jte-font` / `--jte-font-mono` / `--jte-font-size` | `--jte--json-tree--font` / `--font-mono` / `--font-size` |
| `--jte-line-height` | keep `1.45` in CSS; not a public token |

`:host { display/height/width/box-sizing }` stays in `styles.css`. **Do not** put palette tokens on `:host` in `styles.css`.

---

### Task 1: Failing DOM tests for value BEM + parts

**Files:**
- Create: `json-tree-editor/src/components/primitives/theming.test.tsx`

**Interfaces:**
- Consumes: `JsonTreeView` render API
- Produces: tests that later tasks must make pass

- [ ] **Step 1: Write the test file**

```tsx
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import { JsonTreeView } from './JsonTreeView';

afterEach(() => cleanup());

const DOC = JSON.stringify(
  { name: 'Ada', n: 1, ok: true, none: null, nested: { a: 1 }, list: [1] },
  null,
  2,
);

describe('theming DOM contract', () => {
  it('puts BEM type modifiers on the value wrapper', () => {
    render(() => <JsonTreeView value={DOC} onChange={() => {}} />);
    expect(document.querySelector('.json-tree-value.json-tree-value--string')).toBeTruthy();
    expect(document.querySelector('.json-tree-value.json-tree-value--number')).toBeTruthy();
    expect(document.querySelector('.json-tree-value.json-tree-value--boolean')).toBeTruthy();
    expect(document.querySelector('.json-tree-value.json-tree-value--null')).toBeTruthy();
    expect(document.querySelector('.json-tree-input--string')).toBeNull();
  });

  it('exposes row, chevron, search, search-input, and specific action parts', () => {
    render(() => (
      <JsonTreeView value={DOC} onChange={() => {}} search defaultExpandedDepth={2} />
    ));
    const tree = document.querySelector('.json-tree')!;
    // Open find: Cmd/Ctrl+F is handled on the tree; click is not required if search bar mounts only on open.
    // If search is closed by default, dispatch the shortcut:
    tree.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }),
    );
    expect(document.querySelector('[part~="row"]')).toBeTruthy();
    expect(document.querySelector('[part~="chevron"]')).toBeTruthy();
    expect(document.querySelector('[part~="delete"]')).toBeTruthy();
    expect(document.querySelector('[part~="search"]')).toBeTruthy();
    expect(document.querySelector('[part~="search-input"]')).toBeTruthy();
    expect(document.querySelector('[part~="search-close"]')).toBeTruthy();
  });
});
```

If Cmd+F does not open search in jsdom, call whatever existing search test uses (see `JsonTreeView.search.test.tsx`) and copy that open path.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd json-tree-editor && pnpm exec vitest run src/components/primitives/theming.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -- json-tree-editor/src/components/primitives/theming.test.tsx
git commit -m "test: theming DOM contract for value BEM and parts"
```

---

### Task 2: Theme CSS files + package exports

**Files:**
- Create: `json-tree-editor/src/themes/default.css`
- Create: `json-tree-editor/src/themes/high-contrast.css`
- Modify: `json-tree-editor/package.json` (exports map only)

**Depends on:** none (file-disjoint from Task 1)

**Interfaces:**
- Produces: published paths `@binaryoperations/json-tree-editor/themes/default.css` and `.../high-contrast.css`

- [ ] **Step 1: Write `default.css`**

Selector block (only this):

```css
:host,
json-tree-editor,
.json-tree:not(:host *) {
  color-scheme: light dark;
  /* every public token from the spec as light-dark(L, D) */
}
```

Copy **every** hex pair from the spec “Public tokens” tables. Include value aliases:

```css
--jte--json-tree-value--string: var(--jte--json-tree-type--string);
--jte--json-tree-value--number: var(--jte--json-tree-type--number);
--jte--json-tree-value--boolean: var(--jte--json-tree-type--boolean);
--jte--json-tree-value--null: var(--jte--json-tree-type--null);
--jte--json-tree-value--object: var(--jte--json-tree-type--object);
--jte--json-tree-value--array: var(--jte--json-tree-type--array);
```

Font mono stack (same as today):

```css
--jte--json-tree--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
  'Liberation Mono', 'Courier New', monospace;
```

Do **not** set `--jte--json-tree-type--*-bg` in default (structure CSS derives).

- [ ] **Step 2: Write `high-contrast.css`**

Same selector. Surfaces `#ffffff`/`#000000`, text `#000`/`#fff`, borders `#171717`/`#e5e5e5`. Type hues from spec high-contrast table. **Set** opaque `-bg`/`-border` for each type (e.g. `color-mix(in srgb, var(--jte--json-tree-type--string) 18%, var(--jte--json-tree--surface))` is too translucent — use solid fills like `light-dark(#d1fae5, #064e3b)` or similar opaque pairs). Marks: `#000` on `#ffff00`; active `#000` on `#ffd000`.

Also add 3px focus, no glow:

```css
:host .json-tree-node:focus-visible > .json-tree-row,
json-tree-editor .json-tree-node:focus-visible > .json-tree-row,
.json-tree:not(:host *) .json-tree-node:focus-visible > .json-tree-row {
  box-shadow: inset 0 0 0 3px var(--jte--json-tree--focus);
}
```

- [ ] **Step 3: package.json exports** (next to `"./styles.css"`):

```json
"./themes/default.css": "./src/themes/default.css",
"./themes/high-contrast.css": "./src/themes/high-contrast.css"
```

- [ ] **Step 4: Commit**

```bash
git add -- json-tree-editor/src/themes/default.css json-tree-editor/src/themes/high-contrast.css json-tree-editor/package.json
git commit -m "feat: add default and high-contrast theme CSS presets"
```

---

### Task 3: Rewire `styles.css`

**Files:**
- Modify: `json-tree-editor/src/styles.css`

**Depends on:** Task 2

- [ ] **Step 1:** First line after the file comment: `@import './themes/default.css';`

- [ ] **Step 2:** Strip all palette custom properties from `:host`. Keep layout (`display`, `height`, `width`, `box-sizing`). Remove `color-scheme: dark`.

- [ ] **Step 3:** Apply the old→new map. Delete every `, #hex` / `, rgba(...)` fallback on `var()`.

- [ ] **Step 4:** Type chips — for each of string|number|boolean|null|object|array:

```css
.json-tree-type--string {
  color: var(--jte--json-tree-type--string);
  background: var(
    --jte--json-tree-type--string-bg,
    color-mix(in srgb, var(--jte--json-tree-type--string) 18%, transparent)
  );
  border-color: var(
    --jte--json-tree-type--string-border,
    color-mix(in srgb, var(--jte--json-tree-type--string) 40%, transparent)
  );
}
```

- [ ] **Step 5:** Value color via wrapper, not input type class:

```css
.json-tree-value--string { color: var(--jte--json-tree-value--string); }
.json-tree-value--number { color: var(--jte--json-tree-value--number); }
/* boolean, null, object, array */

.json-tree-value--string .json-tree-input,
.json-tree-value--number .json-tree-input,
.json-tree-value--boolean .json-tree-input,
.json-tree-value--null .json-tree-input {
  color: inherit;
}

.json-tree-value--number .json-tree-input {
  font-variant-numeric: tabular-nums;
  max-width: 10rem;
}
```

Delete `.json-tree-input--string`, `--number` (color rules), `--boolean`, `--null` **color** rules. Keep `.json-tree-input--readonly` and `--search-display`.

- [ ] **Step 6:** Default focus ring 2px using `--jte--json-tree--focus`. High-contrast file overrides to 3px.

- [ ] **Step 7:** Commit

```bash
git add -- json-tree-editor/src/styles.css
git commit -m "feat: consume BEM theme tokens in library stylesheet"
```

---

### Task 4: Value BEM + `::part` map

**Files:**
- Modify: `json-tree-editor/src/components/primitives/PrimitiveEditor.tsx`
- Modify: `json-tree-editor/src/components/primitives/StringEditor.tsx`
- Modify: `json-tree-editor/src/components/primitives/NumberEditor.tsx`
- Modify: `json-tree-editor/src/components/primitives/NullEditor.tsx`
- Modify: `json-tree-editor/src/components/primitives/TypeSelect.tsx`
- Modify: `json-tree-editor/src/components/primitives/HighlightText.tsx`
- Modify: `json-tree-editor/src/components/primitives/KeyEditor.tsx`
- Modify: `json-tree-editor/src/components/primitives/TreeSearchBar.tsx`
- Modify: `json-tree-editor/src/components/primitives/JsonTreeNode.tsx`
- Modify: `json-tree-editor/src/components/primitives/JsonTreeView.tsx`
- Modify: `json-tree-editor/src/breadcrumbs/BreadcrumbBar.tsx`
- Modify: `json-tree-editor/src/breadcrumbs/flash-ring.ts`

**Depends on:** Task 1 (tests). Can run parallel to Task 2/3 if files disjoint (they are).

**Part map (spec) — set these exactly:**

| Node | `part` |
|---|---|
| `.json-tree` | `tree` (already) |
| `.json-tree__scroll` | `scroll` |
| `.json-tree__error` | `error` |
| `.json-tree__search` | `search` |
| `.json-tree__search-icon` | `search-icon` |
| `.json-tree__search-input` | `search-input` |
| `.json-tree__search-count` | `search-count` |
| search prev/next/close | `action search-prev` / `action search-next` / `action search-close` |
| `.json-tree-row` | `row` + `search-active` when that class is on |
| drag handle | `drag-handle` |
| chevron | `chevron` + `open` or `leaf` |
| key | `key` + `root` and/or `index` |
| type | `type` + JSON type (`string`, …) |
| value wrapper | `value` + JSON type |
| input | `input` |
| null | `null` |
| summary | `summary` |
| actions cluster | `actions` |
| duplicate / delete | `action duplicate` / `action delete` |
| add-row | `add-row` |
| expand/collapse children | `action expand-children` / `action collapse-children` |
| add key/item/clear | `action add-key` / `action add-item` / `action clear` |
| `.json-tree-children` | `children` |
| mark | `mark` + `active` |
| breadcrumbs | `breadcrumbs` |
| crumb | `crumb` + `current` and/or `index` |
| sep | `breadcrumb-sep` |
| ellipsis | `breadcrumb-ellipsis` |
| flash target | add `flash-ring` to `part` while class `json-tree-flash-ring` is on; remove when class is removed |

`.json-tree__disabled`: no markup today — do **not** invent a panel. Skip.

- [ ] **Step 1: PrimitiveEditor** — wrapper:

```tsx
<span
  class="json-tree-value"
  classList={{ [`json-tree-value--${kind()}`]: true }}
  part={`value ${kind()}`}
>
```

Remove `json-tree-input--string|number|boolean` from class strings; keep `json-tree-input` and `--readonly` / `--search-display`.

- [ ] **Step 2: StringEditor / NumberEditor / NullEditor** — same: no `--string`/`--number`/`--null` type-color classes. NullEditor sits inside `json-tree-value--null`.

- [ ] **Step 3: TypeSelect** — `part={`type ${props.type}`}`.

- [ ] **Step 4: HighlightText** — `part={props.active ? 'mark active' : 'mark'}`.

- [ ] **Step 5: KeyEditor** — `part="key"` already; add `root`/`index` only if those modifiers apply (usually on JsonTreeNode’s non-editable span).

- [ ] **Step 6: TreeSearchBar** — parts per table (`search-icon`, `search-input`, `search-count`, `action search-prev|next|close`).

- [ ] **Step 7: JsonTreeNode** — row `part` includes `search-active` when class is on; chevron `open`/`leaf`; action names; add-row buttons; `part="children"` on `.json-tree-children`.

- [ ] **Step 8: JsonTreeView** — confirm `tree` / `scroll` / `error`.

- [ ] **Step 9: BreadcrumbBar** — crumb/sep/ellipsis parts.

- [ ] **Step 10: flash-ring.ts** — when adding `FLASH_CLASS`, also set `part` to include `flash-ring` (preserve existing part names: read `getAttribute('part')`, append, restore on clear).

- [ ] **Step 11: Run**

```bash
cd json-tree-editor && pnpm exec vitest run src/components/primitives/theming.test.tsx src/components/primitives/JsonTreeView.render.test.tsx src/components/primitives/JsonTreeView.search.test.tsx src/breadcrumbs/breadcrumbs-plugin.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Commit listed TS/TSX files only.**

```bash
git commit -m "feat: BEM value modifiers and complete ::part map"
```

---

### Task 5: Demos

**Files:**
- Modify: `demo/wc.html` (remove `.light { --jte-bg: … }` block)
- Modify: `demo/src/wc-main.ts` (if scheme toggle lives here)
- Modify: `demo/src/App.tsx` and/or `demo/src/components/DemoHeader.tsx` / `demo/src/styles.css`
- Modify: `demo/history.html`, `demo/wc-history.html`, `demo/breadcrumb.html` only if they copy the old light-token block

**Depends on:** Task 2, Task 3

- [ ] Scheme control sets **`color-scheme: light | dark | light dark`** on `json-tree-editor` / `.json-tree`. Values: light, dark, system (`light dark`).
- [ ] High-contrast: `<link rel="stylesheet" href="...high-contrast.css" disabled>` or dynamic import; toggle `disabled` / presence. Do not duplicate tokens in the demo.
- [ ] Delete incomplete `json-tree-editor.light { --jte-bg: #f8fafc; … }` rules.
- [ ] WC demo: one example `json-tree-editor::part(row)` / `::part(search)` in a comment or a tiny optional checkbox is enough; at least document in page copy.
- [ ] Solid main demo gets the same scheme + high-contrast controls (light must not be WC-only).

```bash
git commit -m "demo: color-scheme and high-contrast theme controls"
```

---

### Task 6: Docs

**Files:**
- Modify: `json-tree-editor/README.md` (Theming + `::part` sections)
- Modify: `json-tree-editor/CHANGELOG.md` (Unreleased **Breaking**)
- Modify: `json-tree-editor/src/breadcrumbs/README.md` (flash tokens → `--jte--json-tree-flash-ring`)
- Modify: `json-tree-editor/src/styles.css` file header comment only if Task 3 left the old `--jte-bg` docs

**Depends on:** Task 2

- [ ] README: import `styles.css`; optional `themes/high-contrast.css`; `color-scheme`; compact BEM token groups; full part map (not 70 one-liners).
- [ ] CHANGELOG breaking: removed `--jte-*` 1.0.6 names; OS preference default; input type-color classes gone.
- [ ] Commit.

```bash
git commit -m "docs: theming presets, BEM tokens, and ::part map"
```

---

### Task 7: Verify

**Files:** none new

- [ ] `cd json-tree-editor && pnpm test && pnpm typecheck`
- [ ] Grep: no remaining public `--jte-bg` / `--jte-string` / `--jte-type-string` in `src/` (except `--jte-depth` and `--jte--` names).
- [ ] If tests fail, fix in the owning file from Tasks 1–4; do not drive-by other packages.

---

## Coverage vs spec

| Spec section | Task |
|---|---|
| Scheme / light-dark / files | 2, 3 |
| Token naming + catalog | 2, 3 |
| Type/value BEM | 3, 4, 1 |
| High-contrast | 2, 5 |
| `::part` map | 4, 1 |
| WC selector so host themes win | 2 |
| Breaking docs + demos | 5, 6 |
| Tests | 1, 7 |
