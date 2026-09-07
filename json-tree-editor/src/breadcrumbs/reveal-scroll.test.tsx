import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from '../components/primitives/JsonTreeView';
import { breadcrumbsPlugin } from './breadcrumbs-plugin';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ROW_H = 28;
const VIEWPORT_H = 400;

/** Wide + deep enough that a deep row is far below the shallow ones. */
const DOC = JSON.stringify(
  {
    items: Array.from({ length: 60 }, (_, i) => ({
      sku: `SKU-${i}`,
      meta: { name: `item ${i}`, qty: i },
    })),
    trailing: { note: 'end' },
  },
  null,
  2,
);

/**
 * Give jsdom a layout.
 *
 * Each rendered `.json-tree-node` occupies one `ROW_H` row in document order,
 * and its subtree follows — so a node's natural top is its index × `ROW_H`.
 * Container header rows are `position: sticky; top: 0`, which is the whole
 * point of this test: once scrolled past, a stuck row *reports* itself at the
 * top of the scroller even though the content it heads is far above.
 */
function installLayout(scroller: HTMLElement) {
  Object.defineProperty(scroller, 'scrollTop', { writable: true, value: 0 });

  const rect = (top: number, height: number): DOMRect =>
    ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  vi.spyOn(scroller, 'getBoundingClientRect').mockImplementation(() =>
    rect(0, VIEWPORT_H),
  );

  /** Natural (unstuck) top of a node, in content coordinates. */
  const naturalTop = (node: Element): number => {
    const nodes = Array.from(scroller.querySelectorAll('.json-tree-node'));
    return nodes.indexOf(node) * ROW_H;
  };

  /** (Re)install rect mocks for every node currently in the DOM. */
  const sync = () => {
    for (const node of scroller.querySelectorAll('.json-tree-node')) {
      const el = node as HTMLElement;
      if ((el as { __laidOut?: boolean }).__laidOut) continue;
      (el as { __laidOut?: boolean }).__laidOut = true;

      // The node box is in normal flow: its top is the natural position.
      vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() =>
        rect(naturalTop(el) - scroller.scrollTop, ROW_H),
      );

      const row = el.querySelector(':scope > .json-tree-row');
      if (!(row instanceof HTMLElement)) continue;
      vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => {
        const top = naturalTop(el) - scroller.scrollTop;
        const isStuckContainer =
          el.classList.contains('json-tree-node--container') &&
          el.getAttribute('aria-expanded') === 'true';
        // Sticky rows pin at top: 0 instead of scrolling away.
        return rect(isStuckContainer && top < 0 ? 0 : top, ROW_H);
      });
    }
  };

  sync();
  return { naturalTop, sync };
}

describe('breadcrumb reveal — scroll position', () => {
  it('scrolls a shallow crumb fully into view from deep in the tree', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const pluginList = [breadcrumbsPlugin()];

    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={pluginList}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    const scroller = document.querySelector(
      '.json-tree__scroll',
    ) as HTMLElement;

    // Expand first so every row exists, then give the whole tree a layout.
    // (A browser computes rects on demand; jsdom needs them installed.)
    const deep = ['items', 50, 'meta', 'name'];
    handle!.callCommand('json-tree.expandPath', deep);
    const layout = installLayout(scroller);

    // Navigate deep: items[50].meta.name.
    await handle!.callCommand<Promise<boolean>>('selectPath', deep);
    expect(scroller.scrollTop).toBeGreaterThan(VIEWPORT_H);

    // Click the "items" crumb — root's first child.
    const crumbs = Array.from(
      document.querySelectorAll('.json-tree-breadcrumbs__crumb'),
    ) as HTMLElement[];
    expect(crumbs.map((c) => c.textContent)).toEqual([
      'root',
      'items',
      '[50]',
      'meta',
      'name',
    ]);
    fireEvent.click(crumbs[1]);
    await Promise.resolve();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const itemsNode = scroller.querySelector(
      '[data-path=\'["items"]\']',
    ) as HTMLElement;
    const visibleTop = layout.naturalTop(itemsNode) - scroller.scrollTop;

    // Before the fix this was ~-1100: the sticky row reported itself pinned at
    // the top, so the reveal moved by the sticky-inset difference and stranded
    // the viewport deep in items[50].
    //
    // The items row must clear root's header row (pinned at 0 while scrolled,
    // at its natural 0 when the tree is scrolled to the top) and fit in view.
    expect(visibleTop).toBeGreaterThanOrEqual(ROW_H);
    expect(visibleTop + ROW_H).toBeLessThanOrEqual(VIEWPORT_H);
  });

  it('returns to the top when the root crumb is clicked', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const pluginList = [breadcrumbsPlugin()];

    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={pluginList}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    const scroller = document.querySelector(
      '.json-tree__scroll',
    ) as HTMLElement;
    const deep = ['items', 50, 'meta', 'name'];
    handle!.callCommand('json-tree.expandPath', deep);
    installLayout(scroller);

    await handle!.callCommand<Promise<boolean>>('selectPath', deep);
    expect(scroller.scrollTop).toBeGreaterThan(VIEWPORT_H);

    const crumbs = Array.from(
      document.querySelectorAll('.json-tree-breadcrumbs__crumb'),
    ) as HTMLElement[];
    fireEvent.click(crumbs[0]); // root
    await Promise.resolve();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(scroller.scrollTop).toBe(0);
  });
});
