import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsonTreeView } from './JsonTreeView';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DOC = JSON.stringify(
  {
    name: 'Ada',
    nested: { name: 'Lovelace', city: 'London' },
    tags: ['math', 'poetry'],
  },
  null,
  2,
);

function openSearchFromTree() {
  const tree = screen.getByRole('tree', { name: 'JSON tree' });
  tree.focus();
  fireEvent.keyDown(tree, { key: 'f', metaKey: true });
}

async function typeSearch(text: string) {
  const input = await screen.findByRole('searchbox', {
    name: /search keys and values/i,
  });
  fireEvent.input(input, { target: { value: text } });
  return input;
}

describe('JsonTreeView search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('opens the search bar with Ctrl/Cmd+F when the tree is focused', async () => {
    render(() => <JsonTreeView value={DOC} onChange={() => {}} />);

    expect(
      screen.queryByRole('searchbox', { name: /search keys and values/i }),
    ).toBeNull();

    openSearchFromTree();

    expect(
      await screen.findByRole('searchbox', { name: /search keys and values/i }),
    ).toBeTruthy();
  });

  it('highlights key and value matches with mark after debounce', async () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={2}
      />
    ));

    openSearchFromTree();
    await typeSearch('Ada');
    await vi.advanceTimersByTimeAsync(250);

    const marks = document.querySelectorAll('mark.json-tree-mark');
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(
      Array.from(marks).some((m) => m.textContent === 'Ada'),
    ).toBe(true);
  });

  it('highlights object keys', async () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={2}
      />
    ));

    openSearchFromTree();
    await typeSearch('city');
    await vi.advanceTimersByTimeAsync(250);

    const marks = document.querySelectorAll('mark.json-tree-mark');
    expect(
      Array.from(marks).some((m) => m.textContent === 'city'),
    ).toBe(true);
  });

  it('expands collapsed ancestors so matches become visible', async () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={0}
      />
    ));

    // Nested "Lovelace" not visible when only root is open.
    expect(screen.queryByDisplayValue('Lovelace')).toBeNull();
    expect(screen.queryByText('Lovelace')).toBeNull();

    openSearchFromTree();
    await typeSearch('Lovelace');
    await vi.advanceTimersByTimeAsync(250);

    // Value may render as highlight span text or input.
    expect(
      screen.queryByText('Lovelace') ||
        document.body.textContent?.includes('Lovelace'),
    ).toBeTruthy();
    const marks = document.querySelectorAll('mark.json-tree-mark');
    expect(
      Array.from(marks).some((m) => m.textContent === 'Lovelace'),
    ).toBe(true);
  });

  it('navigates matches with Enter / next button and wraps', async () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={3}
      />
    ));

    openSearchFromTree();
    const input = await typeSearch('name');
    await vi.advanceTimersByTimeAsync(250);

    // Two key matches: "name" and nested "name"
    expect(screen.getByText('1 / 2')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2 / 2')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('1 / 2')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('closes search with Escape and removes marks', async () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={2}
      />
    ));

    openSearchFromTree();
    const input = await typeSearch('Ada');
    await vi.advanceTimersByTimeAsync(250);
    expect(document.querySelectorAll('mark.json-tree-mark').length).toBeGreaterThan(
      0,
    );

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(
      screen.queryByRole('searchbox', { name: /search keys and values/i }),
    ).toBeNull();
    expect(document.querySelectorAll('mark.json-tree-mark').length).toBe(0);
  });

  it('does not treat array indices as key matches', async () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={3}
      />
    ));

    openSearchFromTree();
    await typeSearch('0');
    await vi.advanceTimersByTimeAsync(250);

    // Count should be 0/0 — no key match on index, no value "0"
    expect(screen.getByText('0 / 0')).toBeTruthy();
  });

  it('does not open search when search={false}', async () => {
    render(() => (
      <JsonTreeView value={DOC} onChange={() => {}} search={false} />
    ));

    openSearchFromTree();

    expect(
      screen.queryByRole('searchbox', { name: /search keys and values/i }),
    ).toBeNull();
  });
});
