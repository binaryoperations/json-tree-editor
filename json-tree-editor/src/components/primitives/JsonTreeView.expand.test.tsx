import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  JsonTreeView,
  type ExpandProgress,
  type JsonTreeViewHandle,
} from './JsonTreeView';

afterEach(() => cleanup());

function flushRaf(times = 5): Promise<void> {
  return new Promise((resolve) => {
    let left = times;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const NESTED = JSON.stringify(
  {
    a: { b: { c: 1 } },
    list: [{ x: true }, { y: false }],
  },
  null,
  2,
);

describe('JsonTreeView expandAll / collapseAll', () => {
  it('expandAll opens nested containers; collapseAll returns to root only', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const onExpand = vi.fn();
    const onCollapse = vi.fn();

    render(() => (
      <JsonTreeView
        ref={(h) => {
          handle = h;
        }}
        value={NESTED}
        onChange={() => {}}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    ));

    // Nested "c" / "x" not visible until expanded.
    expect(screen.queryByText('c')).toBeNull();

    handle!.expandAll();
    await flushRaf(20);

    expect(onExpand).toHaveBeenCalledTimes(1);
    const expandedKeys = onExpand.mock.calls[0][0] as Set<string>;
    expect(expandedKeys.size).toBeGreaterThan(1);
    expect(screen.getByText('c')).toBeTruthy();
    expect(screen.getByText('x')).toBeTruthy();

    handle!.collapseAll();
    expect(onCollapse).toHaveBeenCalledTimes(1);
    const collapsedKeys = onCollapse.mock.calls[0][0] as Set<string>;
    expect([...collapsedKeys]).toEqual(['']);
  });

  it('emits progress during expandAll and null when finished', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const progress: Array<ExpandProgress | null> = [];

    render(() => (
      <JsonTreeView
        ref={(h) => {
          handle = h;
        }}
        value={NESTED}
        onChange={() => {}}
        onExpandProgress={(p) => {
          progress.push(p);
        }}
      />
    ));

    handle!.expandAll();
    await flushRaf(20);

    expect(progress.some((p) => p !== null && p.total > 0)).toBe(true);
    expect(progress[progress.length - 1]).toBeNull();
    expect(handle!.isExpanding()).toBe(false);
  });

  it('collapseAll during expandAll cancels without onExpand', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const onExpand = vi.fn();

    render(() => (
      <JsonTreeView
        ref={(h) => {
          handle = h;
        }}
        value={NESTED}
        onChange={() => {}}
        onExpand={onExpand}
      />
    ));

    handle!.expandAll();
    handle!.collapseAll();
    await flushRaf(10);

    expect(onExpand).not.toHaveBeenCalled();
    expect(handle!.isExpanding()).toBe(false);
  });

  it('getRoot returns the .json-tree element', () => {
    let handle: JsonTreeViewHandle | undefined;
    render(() => (
      <JsonTreeView
        ref={(h) => {
          handle = h;
        }}
        value={NESTED}
        onChange={() => {}}
      />
    ));

    const root = handle!.getRoot();
    expect(root).toBeInstanceOf(HTMLDivElement);
    expect(root?.classList.contains('json-tree')).toBe(true);
  });

  it('honors defaultExpandedDepth for initial open paths', () => {
    render(() => (
      <JsonTreeView
        value={NESTED}
        onChange={() => {}}
        defaultExpandedDepth={1}
      />
    ));

    // Depth 1: root + "a" / "list" open → "b" visible; "c" still collapsed.
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.queryByText('c')).toBeNull();
  });

  it('expands via ref even when host tracks disabled UI separately', async () => {
    // JsonTreeView itself has no disabled prop; WC blocks pointer only.
    let handle: JsonTreeViewHandle | undefined;
    const onExpand = vi.fn();

    render(() => (
      <div style={{ 'pointer-events': 'none' }}>
        <JsonTreeView
          ref={(h) => {
            handle = h;
          }}
          value={NESTED}
          onChange={() => {}}
          onExpand={onExpand}
        />
      </div>
    ));

    handle!.expandAll();
    await flushRaf(20);
    expect(onExpand).toHaveBeenCalled();
  });
});
