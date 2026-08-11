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

describe('scrollTreeItemIntoView', () => {
  it('scrolls down when the target sits under the sticky band', () => {
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollTop', {
      writable: true,
      value: 100,
    });

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

    // Scroller viewport 0–200; sticky covers 0–30; child row top is 20 (under sticky).
    mockRect(scroller, { top: 0, bottom: 200, height: 200 });
    mockRect(parentRow, { top: 0, bottom: 30, height: 30 });
    mockRect(childRow, { top: 20, bottom: 48, height: 28 });

    scrollTreeItemIntoView(scroller, child);

    // Need child.top → 30 + pad. delta = 20 - (30+pad) = -(10+pad)
    expect(scroller.scrollTop).toBe(100 + (20 - (30 + TREE_SCROLL_PAD_PX)));
  });

  it('scrolls up when the target is below the viewport', () => {
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollTop', {
      writable: true,
      value: 0,
    });

    const child = document.createElement('div');
    child.className = 'json-tree-node';
    const childRow = document.createElement('div');
    childRow.className = 'json-tree-row';
    child.appendChild(childRow);
    scroller.appendChild(child);

    mockRect(scroller, { top: 0, bottom: 200, height: 200 });
    mockRect(childRow, { top: 250, bottom: 278, height: 28 });

    scrollTreeItemIntoView(scroller, child);

    // delta = 278 - (200 - pad) = 78 + pad
    expect(scroller.scrollTop).toBe(278 - (200 - TREE_SCROLL_PAD_PX));
  });

  it('does nothing when the target is already in the safe band', () => {
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollTop', {
      writable: true,
      value: 50,
    });

    const child = document.createElement('div');
    child.className = 'json-tree-node';
    const childRow = document.createElement('div');
    childRow.className = 'json-tree-row';
    child.appendChild(childRow);
    scroller.appendChild(child);

    mockRect(scroller, { top: 0, bottom: 200, height: 200 });
    mockRect(childRow, { top: 80, bottom: 108, height: 28 });

    scrollTreeItemIntoView(scroller, child);
    expect(scroller.scrollTop).toBe(50);
  });
});
