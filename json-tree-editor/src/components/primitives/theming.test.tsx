import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import { JsonTreeView } from './JsonTreeView';

afterEach(() => {
  cleanup();
});

const DOC = JSON.stringify(
  { name: 'Ada', n: 1, ok: true, none: null, nested: { a: 1 }, list: [1] },
  null,
  2,
);

describe('theming DOM contract', () => {
  it('puts BEM type modifiers on the value wrapper', () => {
    render(() => <JsonTreeView value={DOC} onChange={() => {}} />);

    expect(
      document.querySelector('.json-tree-value.json-tree-value--string'),
    ).toBeTruthy();
    expect(
      document.querySelector('.json-tree-value.json-tree-value--number'),
    ).toBeTruthy();
    expect(
      document.querySelector('.json-tree-value.json-tree-value--boolean'),
    ).toBeTruthy();
    expect(
      document.querySelector('.json-tree-value.json-tree-value--null'),
    ).toBeTruthy();
    expect(document.querySelector('.json-tree-input--string')).toBeNull();
  });

  it('exposes row, chevron, search, search-input, and specific action parts', () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        search
        defaultExpandedDepth={2}
      />
    ));

    const tree = screen.getByRole('tree', { name: 'JSON tree' });
    tree.focus();
    fireEvent.keyDown(tree, { key: 'f', metaKey: true });

    expect(document.querySelector('[part~="row"]')).toBeTruthy();
    expect(document.querySelector('[part~="chevron"]')).toBeTruthy();
    expect(document.querySelector('[part~="delete"]')).toBeTruthy();
    expect(document.querySelector('[part~="search"]')).toBeTruthy();
    expect(document.querySelector('[part~="search-input"]')).toBeTruthy();
    expect(document.querySelector('[part~="search-close"]')).toBeTruthy();
  });
});
