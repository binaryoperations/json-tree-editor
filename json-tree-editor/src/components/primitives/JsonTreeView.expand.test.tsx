import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import { JsonTreeView, type JsonTreeViewHandle } from './JsonTreeView';

afterEach(() => cleanup());

const NESTED = JSON.stringify(
  {
    a: { b: { c: 1 } },
    list: [{ x: true }, { y: false }],
  },
  null,
  2,
);

describe('JsonTreeView expand state', () => {
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

  it('expands one level of children via the toolbar expand control', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(() => (
      <JsonTreeView
        value={NESTED}
        onChange={() => {}}
        defaultExpandedDepth={0}
      />
    ));

    // Root open by default; nested "a" still collapsed.
    expect(screen.queryByText('b')).toBeNull();

    const expandBtns = screen.getAllByRole('button', { name: 'expand' });
    // First expand row is under root
    await user.click(expandBtns[0]);

    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.queryByText('c')).toBeNull();
  });
});
