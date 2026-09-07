# Breadcrumbs plugin

**Import:** `@binaryoperations/json-tree-editor/breadcrumbs`

A **path bar** for the focused tree row, plus the **`selectPath`** command: expand
ancestors → scroll the row into view → flash a ring around its key.

Parent package docs: [package README](../../README.md).

This plugin is also the reference implementation of the optional plugin
[`render` hook](../../README.md#render--plugin-ui) — the bar is not host markup, it
is UI the plugin contributes. Turning the plugin off removes the bar *and*
`selectPath` together.

---

## Bootstrap

<details open>
<summary>Solid</summary>

```tsx
import { createSignal } from 'solid-js';
import { JsonTreeView, type JsonTreeViewHandle } from '@binaryoperations/json-tree-editor';
import { breadcrumbsPlugin } from '@binaryoperations/json-tree-editor/breadcrumbs';
import '@binaryoperations/json-tree-editor/styles.css';

// Stable instance — the plugin owns the bar's state.
const plugins = [breadcrumbsPlugin()];

export function EditorWithBreadcrumbs() {
  const [json, setJson] = createSignal('{"meta":{"author":{"name":"Ada"}}}');
  let handle: JsonTreeViewHandle | undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => handle?.callCommand('selectPath', ['meta', 'author', 'name'])}
      >
        Jump to meta.author.name
      </button>

      {/* The bar is rendered by the plugin — no extra markup here. */}
      <JsonTreeView
        value={json()}
        onChange={setJson}
        plugins={plugins}
        ref={(h) => {
          handle = h;
        }}
      />
    </>
  );
}
```

</details>

<details>
<summary>Web component</summary>

```ts
import '@binaryoperations/json-tree-editor/web-component';
import { breadcrumbsPlugin } from '@binaryoperations/json-tree-editor/breadcrumbs';

const el = document.querySelector('json-tree-editor')!;
el.value = '{"meta":{"author":{"name":"Ada"}}}';

// Same plugin object a Solid host uses — the bar renders in the shadow root.
el.plugins = [breadcrumbsPlugin({ stage: 'head' })];

if (el.hasCommand('selectPath')) {
  await el.callCommand('selectPath', ['meta', 'author', 'name']);
  // …or an RFC 6901 pointer:
  await el.callCommand('selectPath', '/meta/author/name');
}
```

</details>

> Prefer a **stable instance**. The plugin holds the bar's state, so a list that
> changes identity on unrelated re-renders reinstalls it and resets the bar.

---

## Options

```ts
breadcrumbsPlugin(options?: BreadcrumbsPluginOptions)
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `stage` | `'head' \| 'tail'` | `'head'` | Bar above the find bar and tree, or below the tree |
| `focus` | `boolean` | `true` | Move DOM focus to the revealed row |
| `flash` | `boolean` | `true` | Flash a ring around the target key once the scroll lands |
| `maxSegments` | `number` | `8` | Collapse the middle to `…` past this many crumbs (`0` disables). Root and the last two always survive |
| `label` | `string` | `'JSON path'` | `aria-label` for the `nav` landmark |
| `rootLabel` | `string` | `'root'` | Label for the root crumb |

---

## Commands

### `selectPath`

```ts
callCommand('selectPath', path: JsonPath | string, opts?: { focus?: boolean; flash?: boolean })
  => Promise<boolean>
```

Accepts a `JsonPath` array (`['items', 0, 'name']`) or an RFC 6901 JSON Pointer
string (`'/items/0/name'`). Resolves `true` when the row was revealed, `false` when
the path is not in the document. `opts` overrides the plugin's `focus` / `flash`
defaults for one call.

It never edits the document — reveal only.

**`selectPath` ships with this plugin, not with the editor.** Without it,
`hasCommand('selectPath')` is `false` and `callCommand` returns `undefined`. It is
registered non-exclusively, so another plugin registering the same name becomes a
**subordinate** rather than replacing it (first registrant is master).

Internally it composes the view primitives, which any plugin can use:

```ts
ctx.callCommand('json-tree.expandPath', path);
const row = await ctx.callCommand('json-tree.revealPath', path, { focus });
if (row) requestAnimationFrame(() => ring.flash(row));
```

`revealPath` resolves the row element rather than a boolean, which is what keeps the
flash ring in this plugin — the view scrolls (it owns expand state and the sticky-header
insets), the plugin decorates. See
[the plugin contract](../../README.md#render--plugin-ui).

---

## Behaviour

- The bar follows the **focused row** (`json-tree.onFocusedPathChange`), including
  keyboard arrow navigation.
- Every crumb except the last is a **button**. The last one is the current row, so it
  is inert and carries `aria-current="location"`.
- Clicking a crumb reveals that ancestor — scroll and a flashed ring, no edit.
- Long paths collapse in the middle (`root › … › items › [2]`).

### Accessibility

`nav[aria-label]` › `ol` › `li` › `button`, with `aria-current="location"` on the
current segment. The ellipsis is labelled `path truncated`. The flash respects
`prefers-reduced-motion` (steady ring instead of an animation).

### Styling

Theme via the same CSS custom properties as the editor:

| Token | Default | Used for |
| --- | --- | --- |
| `--jte-flash-ring` | `#f59e0b` | Reveal ring color |
| `--jte-flash-bg` | `#f59e0b33` | Reveal ring fill |

Classes: `.json-tree-breadcrumbs`, `__list`, `__item`, `__sep`, `__crumb`
(`--current`, `--index`), `__ellipsis`, plus `.json-tree-flash-ring` for the reveal
ring. Shadow DOM consumers can target `::part(breadcrumbs)`.

The ring pulses **twice** (`450ms × 2`); under `prefers-reduced-motion` it is a single
steady ring instead. Its timers live in this plugin (`flash-ring.ts`) and are cleared on
teardown; only the keyframes sit in the library stylesheet, because the web component
inlines exactly one sheet into its shadow root. Changing the pulse count means changing
both — `FLASH_PULSE_MS × FLASH_PULSES` must equal the CSS `duration × iteration-count`.

---

## Exports

| Export | What |
| --- | --- |
| `breadcrumbsPlugin(options?)` | The plugin factory |
| `SELECT_PATH_COMMAND` | `'selectPath'` — the command name it masters |
| `BreadcrumbBar` | The bar component, if you want to render it yourself |
| `buildSegments(path, rootLabel, maxSegments)` | Crumb list builder (collapsing included) |
| `createFlashRing(flashMs?)` | The reveal ring — `{ flash(row), dispose() }` |
| `BreadcrumbsPluginOptions`, `BreadcrumbSegment`, `BreadcrumbBarProps` | Types |
