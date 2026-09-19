# Theming layer

**Status:** draft for review  
**Date:** 2026-09-18  
**Package:** `@binaryoperations/json-tree-editor`

Replace the dark-only `--jte-*` token dump with a **named CSS preset** layer. Light and dark are first-class. Hosts override colors through BEM-named custom properties.

## Problem

The library hardcodes `color-scheme: dark` and ~70 dark `--jte-*` variables on `:host`. The WC demo “light” class remaps a subset; type chips, search marks, errors, flash, and focus stay dark-tinted. There is no shipped light palette, no high-contrast preset, and no stable naming scheme for overrides.

Nobody is consuming the current `--jte-*` public names, so they can be replaced with no aliases.

## Goals

1. **Default scheme is `prefers-color-scheme`.** The tree sets `color-scheme: light dark`. Hosts force a side with `color-scheme: light` or `color-scheme: dark`.
2. **Named presets as CSS files:** `default` and `high-contrast`.
3. **Great defaults** — complete light and dark palettes (every token, not a partial remap).
4. **Easy overrides** — set any public token on `.json-tree` / `json-tree-editor` after the preset.
5. **BEM tokens** namespaced with `--jte--`, so hyphenated block names stay unambiguous.
6. **Every utility exposes a `::part`** so WC hosts can style row, chevron, buttons, search, etc. without piercing the shadow.

## Non-goals

- JS theme API, `theme=""` attribute, or `data-color-scheme`
- `light-dark()` fallbacks via `@media (prefers-color-scheme)` (no dual encoding)
- Extra named looks beyond `default` and `high-contrast`
- Theming the **demo shell** (page chrome, CodeMirror). Demo shell may stay dark; the **tree** follows this spec
- Marketplace / runtime preset switching beyond “import a CSS file”

## Scheme

Theme files (and only theme files) assign tokens with:

```css
:host,
json-tree-editor,
.json-tree:not(:host *) {
  color-scheme: light dark;
}
```

`.json-tree:not(:host *)` applies in Solid light DOM. Inside the WC shadow it does **not** match, so tokens live on `:host` and inherit. A document import of `high-contrast.css` can then set variables on `json-tree-editor` and the inner tree follows. Do **not** assign theme tokens on `.json-tree` inside the shadow or host-level presets cannot win.

Every color token is `light-dark(<light>, <dark>)`.

| Host sets | Result |
|---|---|
| nothing (`color-scheme: light dark` from the preset) | OS `prefers-color-scheme` |
| `color-scheme: light` on the tree / WC host | light palette |
| `color-scheme: dark` | dark palette |

Native controls and scrollbars follow the same `color-scheme`.

`light-dark()` is the only switch. Safari 17.4 and older (~0.91% global, shrinking) will not get scheme-correct tokens; that is accepted.

## Files and loading

| Export | Role |
|---|---|
| `@binaryoperations/json-tree-editor/styles.css` | Structure (layout, BEM classes) **plus** `@import` of the default preset |
| `@binaryoperations/json-tree-editor/themes/default.css` | Default tokens only (also imported by `styles.css`) |
| `@binaryoperations/json-tree-editor/themes/high-contrast.css` | High-contrast tokens; same names |

Layout in `styles.css` uses `var(--jte--…)` **without** dark hardcoded fallbacks. Missing tokens mean unstyled, not a shadow dark theme.

### Solid

```ts
import '@binaryoperations/json-tree-editor/styles.css';
// optional:
import '@binaryoperations/json-tree-editor/themes/high-contrast.css';
```

High-contrast **after** `styles.css` so it wins.

### Web component

Default tokens ship inside the shadow (today’s inject of `styles.css`). High-contrast is a **document** stylesheet:

```css
@import '@binaryoperations/json-tree-editor/themes/high-contrast.css';
```

That file targets `json-tree-editor, .json-tree` so variables land on the host and inherit into the shadow.

### Override

```css
json-tree-editor,
.json-tree {
  --jte--json-tree-type--string: light-dark(#0b3, #6f6);
  color-scheme: light; /* optional force */
}
```

## Token naming

Parse by splitting on `--`:

```text
--jte--{block}
--jte--{block}--{modifier}
--jte--{block}__{element}
--jte--{block}__{element}--{modifier}
```

- `--jte--` is the namespace delimiter (not `--jte-`).
- `{block}` may contain hyphens: `json-tree-type`, `json-tree-flash-ring`.
- `{modifier}` may contain hyphens: `string-bg`, `search-active`.

`--jte--json-tree-type--string` → `jte` | `json-tree-type` | `string`.

When one class has several paints, extra slots are modifiers on that block: `--jte--json-tree--bg`, `--jte--json-tree--color`.

No old names: `--jte-bg`, `--jte-string`, `--jte-type-string` are gone.

## Public tokens

Presets assign **all** of these. Hosts may override any of them. Values below are the **default** preset.

`L` = light, `D` = dark.

### Tree surface (`.json-tree`)

| Token | L | D |
|---|---|---|
| `--jte--json-tree--bg` | `#f4f5f7` | `#0c0e12` |
| `--jte--json-tree--color` | `#1c1f26` | `#e6e8ec` |
| `--jte--json-tree--border` | `#d5d8e0` | `#2a2f3a` |
| `--jte--json-tree--muted` | `#5c6370` | `#8b93a3` |
| `--jte--json-tree--surface` | `#ffffff` | `#12151c` |
| `--jte--json-tree--font` | `inherit` | `inherit` |
| `--jte--json-tree--font-mono` | system ui-monospace stack (same as today) | same |
| `--jte--json-tree--font-size` | `12.5px` | `12.5px` |

### Row / actions

| Token | L | D |
|---|---|---|
| `--jte--json-tree-row--hover` | `#eceef2` | `#151922` |
| `--jte--json-tree-row--focus` | `#e4e7ee` | `#151a24` |
| `--jte--json-tree-row--search-active` | `#f5edd6` | `#1c191755` |
| `--jte--json-tree-action` | `#4b5563` | `#9aa3b2` |
| `--jte--json-tree-action--danger` | `#b91c1c` | `#fca5a5` |

### Keys (role, not JSON type)

| Token | L | D |
|---|---|---|
| `--jte--json-tree-key` | `#1d4ed8` | `#93c5fd` |
| `--jte--json-tree-key--root` | `#6d28d9` | `#c4b5fd` |
| `--jte--json-tree-key--index` | `#4b5563` | `#a5b4c8` |

### Types (semantic) and values

JSON types: `string` | `number` | `boolean` | `null` | `object` | `array`.

| Type | Token | L | D |
|---|---|---|---|
| string | `--jte--json-tree-type--string` | `#0d7a45` | `#86efac` |
| number | `--jte--json-tree-type--number` | `#b45309` | `#fcd34d` |
| boolean | `--jte--json-tree-type--boolean` | `#5b21b6` | `#c4b5fd` |
| null | `--jte--json-tree-type--null` | `#575f6b` | `#9ca3af` |
| object | `--jte--json-tree-type--object` | `#0369a1` | `#7dd3fc` |
| array | `--jte--json-tree-type--array` | `#be185d` | `#f9a8d4` |

Value tokens **default to the matching type token** in the preset:

```css
--jte--json-tree-value--string: var(--jte--json-tree-type--string);
/* …number, boolean, null, object, array */
```

Override `--jte--json-tree-type--string` to recolor chip + value. Override `--jte--json-tree-value--string` to split them.

Optional chip layers (unset in the preset; structure CSS derives):

- `--jte--json-tree-type--string-bg`
- `--jte--json-tree-type--string-border`

(and the same `-bg` / `-border` suffix for the other five types).

Default derivation in `styles.css`:

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

High-contrast **sets** the `-bg` / `-border` tokens to opaque colors (no reliance on translucent mix).

### Focus, find, flash, error

| Token | L | D |
|---|---|---|
| `--jte--json-tree--focus` | `#2563eb` | `#60a5fa` |
| `--jte--json-tree-mark` | `#854d0e` | `#fef3c7` |
| `--jte--json-tree-mark-bg` | `#fde68a` | `#fbbf2488` |
| `--jte--json-tree-mark--active` | `#422006` | `#fffbeb` |
| `--jte--json-tree-mark--active-bg` | `#f59e0b` | `#f59e0bcc` |
| `--jte--json-tree-flash-ring` | `#d97706` | `#f59e0b` |
| `--jte--json-tree__error` | `#9f1239` | `#fca5a5` |
| `--jte--json-tree__error-bg` | `#fef2f2` | `#1c0f0f` |
| `--jte--json-tree__error-border` | `#fecaca` | `#7f1d1d` |

### Breadcrumbs

Reuse key tokens for crumb color (`.json-tree-breadcrumbs__crumb` → `--jte--json-tree-key`, index → `--jte--json-tree-key--index`). No extra public tokens unless a color cannot be expressed that way.

## Class contract (DOM)

| Surface | Classes |
|---|---|
| Type chip / select | `.json-tree-type.json-tree-type--{type}` (already) |
| Value wrapper | `.json-tree-value.json-tree-value--{type}` **add** |
| String/number/boolean/null inputs | `.json-tree-input` only — **remove** `.json-tree-input--string` (and `--number`, `--boolean`, `--null`) as the color mechanism. Color inherits from `.json-tree-value--{type}`. Keep `.json-tree-input--readonly` (state, not type). |
| Null display | keep `.json-tree-null` for the empty-null affordance; color from `.json-tree-value--null` |

`.json-tree-input--number` may keep **layout** bits that are not color (`font-variant-numeric`, `max-width`) via a non-color class if needed, e.g. leave those rules on `.json-tree-value--number .json-tree-input` so we do not smuggle type color through `--number`.

## `::part` contract (web component)

Tokens set color. **`::part` is how a host restyles a specific control** (size, display, extra chrome) through the open shadow.

Solid hosts already see BEM classes in light DOM. Parts are required for `<json-tree-editor>` and must exist on the same nodes as the BEM classes (Solid can keep `part` attributes; they are harmless).

### Naming

- One **stem** per utility, matching the BEM block after `json-tree-` / `json-tree__`: `.json-tree-row` → `row`, `.json-tree__search` → `search`.
- **Variants are extra part tokens** on the same node (space-separated). Hosts can target the family or the instance:

```css
json-tree-editor::part(action) { /* every button */ }
json-tree-editor::part(delete) { /* delete only */ }
json-tree-editor::part(action delete) { /* same node, both names */ }
json-tree-editor::part(chevron) { /* expand/collapse cue */ }
json-tree-editor::part(type string) { /* string type chip */ }
```

- Do not invent a parallel vocabulary. If the class is `.json-tree-action--danger`, parts are `action` + `delete` (role), not a third name.

### Map

Every public utility below **must** have `part` set. Names already shipped stay (`row`, `chevron`, `search`, `action`, …). Gaps are filled.

| Utility | Class | `part` |
|---|---|---|
| Tree root | `.json-tree` | `tree` |
| Scroll body | `.json-tree__scroll` | `scroll` |
| Parse / empty error | `.json-tree__error` | `error` |
| Disabled panel | `.json-tree__disabled` | `disabled` |
| Find bar | `.json-tree__search` | `search` |
| Find icon | `.json-tree__search-icon` | `search-icon` |
| Find input | `.json-tree__search-input` | `search-input` |
| Find count | `.json-tree__search-count` | `search-count` |
| Find prev / next / close | `.json-tree__search-btn` | `action search-prev` / `action search-next` / `action search-close` |
| Row | `.json-tree-row` | `row`; add `search-active` when that modifier is on |
| Drag handle | `.json-tree-drag-handle` | `drag-handle` |
| Expand / collapse cue | `.json-tree-chevron` | `chevron`; add `open` or `leaf` |
| Key | `.json-tree-key` | `key`; add `root` or `index` |
| Type chip / select | `.json-tree-type` | `type` + JSON type (`string`, `number`, …) |
| Value | `.json-tree-value` | `value` + JSON type |
| Value / key input | `.json-tree-input` | `input` |
| Null affordance | `.json-tree-null` | `null` |
| Container summary | `.json-tree-summary` | `summary` |
| Row action cluster | `.json-tree-actions` | `actions` |
| Duplicate / delete | `.json-tree-action` | `action duplicate` / `action delete` |
| Add / expand toolbar | `.json-tree-add-row` | `add-row` |
| Expand / collapse children | `.json-tree-add-row__btn` | `action expand-children` / `action collapse-children` |
| Add key / item / clear | `.json-tree-add-row__btn` | `action add-key` / `action add-item` / `action clear` |
| Nested group | `.json-tree-children` | `children` |
| Search mark | `.json-tree-mark` | `mark`; add `active` |
| Breadcrumb bar | `.json-tree-breadcrumbs` | `breadcrumbs` |
| Crumb | `.json-tree-breadcrumbs__crumb` | `crumb`; add `current` and/or `index` |
| Crumb separator | `.json-tree-breadcrumbs__sep` | `breadcrumb-sep` |
| Truncation ellipsis | `.json-tree-breadcrumbs__ellipsis` | `breadcrumb-ellipsis` |
| Reveal flash | `.json-tree-flash-ring` | `flash-ring` (set while the class is on) |

Tree items (`.json-tree-node`) do not need a part if hosts style `::part(row)`; skip unless a host cannot reach the row.

### Search and buttons today

Search prev/next/close currently share `part="action"` only — **not enough**. They must gain the specific names above. Same for duplicate vs delete vs add-key: keep `action` as the family, add the role.

## High-contrast preset

Same token names. Differences:

| Axis | default | high-contrast |
|---|---|---|
| Surfaces | Soft zinc paper / `#0c0e12` | `#ffffff` / `#000000` |
| Text | `#1c1f26` / `#e6e8ec` | `#000000` / `#ffffff` |
| Border | Muted | `#171717` / `#e5e5e5` |
| Type hues | Density-first | Recalculated for **~7:1** against that surface |
| Type chips | Translucent `color-mix` | **Set** `-bg` / `-border` to opaque fills |
| Focus | 2px ring using `--jte--json-tree--focus` | 3px ring, no alpha glow |
| Marks | Soft amber | Ink (`#000`) on `#ffff00`; active `#000` on `#ffd000` |

High-contrast type hues (implement these):

| Type | L (on white) | D (on black) |
|---|---|---|
| string | `#005c2e` | `#5cff9f` |
| number | `#7c2d12` | `#ffd60a` |
| boolean | `#4c1d95` | `#d8b4fe` |
| null | `#27272a` | `#e4e4e7` |
| object | `#0c4a6e` | `#7dd3fc` |
| array | `#9f1239` | `#fb7185` |
| key | `#1e3a8a` | `#93c5fd` |

## Preset file shape

```css
/* themes/default.css */
:host,
json-tree-editor,
.json-tree:not(:host *) {
  color-scheme: light dark;

  --jte--json-tree--bg: light-dark(#f4f5f7, #0c0e12);
  --jte--json-tree--color: light-dark(#1c1f26, #e6e8ec);
  /* …every public token… */

  --jte--json-tree-value--string: var(--jte--json-tree-type--string);
  /* … */
}
```

`high-contrast.css` uses the same selectors and names, different `light-dark()` pairs, plus explicit `--jte--json-tree-type--string-bg` (etc.).

`styles.css` starts with `@import './themes/default.css';` then structural rules.

## Breaking changes

- All `--jte-*` names from 1.0.6 / README (including `--jte-bg`, `--jte-string`, `--jte-type-string`) are removed. No aliases.
- `color-scheme: dark` is no longer hardcoded; default follows OS preference.
- `.json-tree-input--string` / `--number` / `--boolean` / `--null` are not the type-color API.

Document in `CHANGELOG.md` under Unreleased **Breaking**. Rewrite the README Theming section around presets + `color-scheme` + the BEM token table (compact groups, not 70 one-liners) + the full `::part` map.

## Demos

- WC demo: keep a scheme control, but it must set **`color-scheme`** (not a partial `.light` token list). Remove the incomplete `json-tree-editor.light { --jte-bg: … }` block.
- Add a **high-contrast** toggle that injects/removes the high-contrast stylesheet (or a class on `document` that does not replace the tree preset — prefer actually importing the file or a `disabled` `<link>`).
- Solid demos: at least one control to force light / dark / system and to load high-contrast, so light is not WC-only.

## Tests

- DOM: value wrapper has `.json-tree-value--{type}` for each JSON type (extend existing render tests).
- DOM: `part` on row, chevron, search, search-input, and at least one specific action (`delete` or `search-close`) — WC hosts depend on these.
- No requirement to screenshot palettes in unit tests.
- Manual: demo light, dark, system, high-contrast, a one-token override (`--jte--json-tree-type--string`), and a `::part(row)` / `::part(search)` override on the WC demo.

## Implementation sketch (not a full plan)

1. Extract tokens from `:host` in `styles.css` into `themes/default.css` using the new names and `light-dark()`.
2. Add `themes/high-contrast.css`.
3. Point structure CSS at the new tokens; drop dark fallbacks.
4. Add `.json-tree-value--{type}`; stop coloring via `.json-tree-input--{type}`.
5. Fill `part` gaps (search internals, specific actions, type/value extra tokens, breadcrumbs crumbs, children, flash-ring).
6. Package exports for the two theme files.
7. README + CHANGELOG + demos.

## Open questions

None — scheme, files, naming, token set, high-contrast, `::part` map, and “no `--jte-*` aliases” were decided in design review.
