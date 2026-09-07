import { describe, expect, it, vi } from 'vitest';

import {
  measureStickyTopInset,
  scrollTreeItemIntoView,
  TREE_SCROLL_PAD_PX,
} from './scroll-into-view';

function mockRect(
  el: Element,
  rect: { top: number; bottom: number; height: number; left?: number; width?: number },
) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left ?? 0,
    width: rect.width ?? 100,
    right: (rect.left ?? 0) + (rect.width ?? 100),
    x: rect.left ?? 0,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('measureStickyTopInset', () => {
  it('returns the tallest sticky ancestor row height', () => {
    const scroller = document.createElement('div');
    const parent = document.createElement('div');
    parent.className = 'json-tree-node json-tree-node--container';
    parent.setAttribute('aria-expanded', 'true');
    const parentRow = document.createElement('div');
    parentRow.className = 'json-tree-row';
    parent.appendChild(parentRow);

    const child = document.createElement('div');
    child.className = 'json-tree-node';
    const childRow = document.createElement('div');
    childRow.className = 'json-tree-row';
    child.appendChild(childRow);
    parent.appendChild(child);
    scroller.appendChild(parent);

    mockRect(parentRow, { top: 0, bottom: 30, height: 30 });
    mockRect(childRow, { top: 40, bottom: 68, height: 28 });

    expect(measureStickyTopInset(scroller, child)).toBe(30);
  });

  it('ignores the item own sticky row', () => {
    const scroller = document.createElement('div');
    const node = document.createElement('div');
    node.className = 'json-tree-node json-tree-node--container';
    node.setAttribute('aria-expanded', 'true');
    const row = document.createElement('div');
    row.className = 'json-tree-row';
    node.appendChild(row);
    scroller.appendChild(node);

    mockRect(row, { top: 0, bottom: 32, height: 32 });

    expect(measureStickyTopInset(scroller, node)).toBe(0);
  });
});

/** A tree node: outer box in normal flow, inner row that may be sticky. */
function makeNode(
  opts: { container?: boolean; expanded?: boolean } = {},
): { node: HTMLElement; row: HTMLElement } {
  const node = document.createElement('div');
  node.className = opts.container
    ? 'json-tree-node json-tree-node--container'
    : 'json-tree-node';
  if (opts.expanded) node.setAttribute('aria-expanded', 'true');
  const row = document.createElement('div');
  row.className = 'json-tree-row';
  node.appendChild(row);
  return { node, row };
}

function makeScroller(scrollTop: number): HTMLElement {
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'scrollTop', { writable: true, value: scrollTop });
  return scroller;
}

describe('scrollTreeItemIntoView', () => {
  it('scrolls down when the target sits under the sticky band', () => {
    const scroller = makeScroller(100);
    const parent = makeNode({ container: true, expanded: true });
    const child = makeNode();
    parent.node.appendChild(child.node);
    scroller.appendChild(parent.node);

    // Scroller viewport 0–200; sticky covers 0–30; child row top is 20 (under sticky).
    mockRect(scroller, { top: 0, bottom: 200, height: 200 });
    mockRect(parent.node, { top: 0, bottom: 200, height: 200 });
    mockRect(parent.row, { top: 0, bottom: 30, height: 30 });
    mockRect(child.node, { top: 20, bottom: 48, height: 28 });
    mockRect(child.row, { top: 20, bottom: 48, height: 28 });

    scrollTreeItemIntoView(scroller, child.node);

    // Need child.top → 30 + pad. delta = 20 - (30+pad) = -(10+pad)
    expect(scroller.scrollTop).toBe(100 + (20 - (30 + TREE_SCROLL_PAD_PX)));
  });

  it('scrolls up when the target is below the viewport', () => {
    const scroller = makeScroller(0);
    const child = makeNode();
    scroller.appendChild(child.node);

    mockRect(scroller, { top: 0, bottom: 200, height: 200 });
    mockRect(child.node, { top: 250, bottom: 278, height: 28 });
    mockRect(child.row, { top: 250, bottom: 278, height: 28 });

    scrollTreeItemIntoView(scroller, child.node);

    // delta = 278 - (200 - pad) = 78 + pad
    expect(scroller.scrollTop).toBe(278 - (200 - TREE_SCROLL_PAD_PX));
  });

  it('does nothing when the target is already in the safe band', () => {
    const scroller = makeScroller(50);
    const child = makeNode();
    scroller.appendChild(child.node);

    mockRect(scroller, { top: 0, bottom: 200, height: 200 });
    mockRect(child.node, { top: 80, bottom: 108, height: 28 });
    mockRect(child.row, { top: 80, bottom: 108, height: 28 });

    scrollTreeItemIntoView(scroller, child.node);
    expect(scroller.scrollTop).toBe(50);
  });

  it('scrolls back up to an expanded container whose row is stuck at the top', () => {
    // The regression: revealing a container from deep inside its own subtree.
    // Its sticky row reports itself pinned at 0 and looks visible, but the
    // container actually starts 900px above the viewport.
    const scroller = makeScroller(1000);
    const root = makeNode({ container: true, expanded: true });
    const target = makeNode({ container: true, expanded: true });
    root.node.appendChild(target.node);
    scroller.appendChild(root.node);

    mockRect(scroller, { top: 0, bottom: 400, height: 400 });
    mockRect(root.node, { top: -1000, bottom: 2000, height: 3000 });
    mockRect(root.row, { top: 0, bottom: 28, height: 28 }); // pinned
    mockRect(target.node, { top: -900, bottom: 1500, height: 2400 });
    mockRect(target.row, { top: 0, bottom: 28, height: 28 }); // pinned too

    scrollTreeItemIntoView(scroller, target.node);

    // Natural top -900 must land under root's 28px sticky band + pad.
    expect(scroller.scrollTop).toBe(1000 + (-900 - (28 + TREE_SCROLL_PAD_PX)));
  });

  it('only requires the header row to fit, not the whole subtree', () => {
    // A tall expanded container near the bottom scrolls just enough to show
    // its row — not its entire (viewport-exceeding) subtree.
    const scroller = makeScroller(0);
    const target = makeNode({ container: true, expanded: true });
    scroller.appendChild(target.node);

    mockRect(scroller, { top: 0, bottom: 400, height: 400 });
    mockRect(target.node, { top: 380, bottom: 3380, height: 3000 });
    mockRect(target.row, { top: 380, bottom: 408, height: 28 });

    scrollTreeItemIntoView(scroller, target.node);

    // Row bottom 380+28=408 → past 400-pad. Subtree height is irrelevant.
    expect(scroller.scrollTop).toBe(408 - (400 - TREE_SCROLL_PAD_PX));
  });
});
