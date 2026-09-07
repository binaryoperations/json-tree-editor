import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from '../components/primitives/JsonTreeView';
import { breadcrumbsPlugin } from './breadcrumbs-plugin';
import { buildSegments } from './BreadcrumbBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DOC = JSON.stringify(
  { meta: { author: { email: 'a@b.c' } }, items: [{ name: 'alpha' }] },
  null,
  2,
);

/**
 * One fresh instance per test, held in a local const.
 *
 * The list must be stable across props reads: an inline
 * `plugins={[breadcrumbsPlugin()]}` re-runs the factory on every read (Solid
 * compiles it to a getter), handing the view a plugin whose signal nothing
 * writes to.
 */
const plugins = (options?: Parameters<typeof breadcrumbsPlugin>[0]) => [
  breadcrumbsPlugin(options),
];

const crumbs = () =>
  Array.from(
    document.querySelectorAll('.json-tree-breadcrumbs__crumb'),
  ) as HTMLElement[];

describe('buildSegments', () => {
  it('prefixes root and labels array indices with brackets', () => {
    const segs = buildSegments(['items', 0, 'name'], 'root', 0);
    expect(segs.map((s) => (s as { label: string }).label)).toEqual([
      'root',
      'items',
      '[0]',
      'name',
    ]);
    expect((segs[2] as { isIndex: boolean }).isIndex).toBe(true);
    expect((segs[3] as { path: unknown }).path).toEqual(['items', 0, 'name']);
  });

  it('collapses the middle past maxSegments, keeping root and the last two', () => {
    const segs = buildSegments(['a', 'b', 'c', 'd', 'e'], 'root', 4);
    expect(segs).toHaveLength(4);
    expect((segs[0] as { label: string }).label).toBe('root');
    expect(typeof segs[1]).toBe('symbol');
    expect((segs[3] as { label: string }).label).toBe('e');
  });

  it('does not collapse when maxSegments is 0', () => {
    expect(buildSegments(['a', 'b', 'c', 'd', 'e'], 'root', 0)).toHaveLength(6);
  });
});

describe('breadcrumbsPlugin', () => {
  it('renders a nav landmark in the head slot with root only at first', () => {
    const pluginList = plugins();
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={pluginList}
      />
    ));

    const nav = screen.getByRole('navigation', { name: 'JSON path' });
    expect(nav).toBeTruthy();
    // Root is the only (and current) segment — inert, so not a button.
    expect(crumbs()).toHaveLength(1);
    expect(crumbs()[0].getAttribute('aria-current')).toBe('location');
  });

  it('tracks the focused row and renders it as the current crumb', () => {
    const pluginList = plugins();
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={3}
        plugins={pluginList}
      />
    ));

    const row = document.querySelector(
      '[data-path=\'["meta","author","email"]\']',
    ) as HTMLElement;
    expect(row).toBeTruthy();
    fireEvent.focusIn(row);

    expect(crumbs().map((c) => c.textContent)).toEqual([
      'root',
      'meta',
      'author',
      'email',
    ]);
    const current = crumbs()[3];
    expect(current.getAttribute('aria-current')).toBe('location');
    expect(current.tagName).toBe('SPAN');
    // Ancestors stay clickable.
    expect(crumbs()[1].tagName).toBe('BUTTON');
  });

  it('masters selectPath: expands ancestors, reveals and flashes the key', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const pluginList = plugins();
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

    expect(handle!.hasCommand('selectPath')).toBe(true);
    // Collapsed by default — the deep row is not in the DOM yet.
    expect(
      document.querySelector('[data-path=\'["meta","author","email"]\']'),
    ).toBeNull();

    const ok = await handle!.callCommand<Promise<boolean>>('selectPath', [
      'meta',
      'author',
      'email',
    ]);
    expect(ok).toBe(true);

    const row = document.querySelector(
      '[data-path=\'["meta","author","email"]\']',
    ) as HTMLElement;
    expect(row).toBeTruthy();
    expect(document.activeElement).toBe(row);

    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(
      row.querySelector('.json-tree-flash-ring'),
    ).toBeTruthy();
  });

  it('selectPath accepts an RFC 6901 pointer', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const pluginList = plugins();
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

    const ok = await handle!.callCommand<Promise<boolean>>(
      'selectPath',
      '/items/0/name',
    );
    expect(ok).toBe(true);
    expect(
      document.querySelector('[data-path=\'["items",0,"name"]\']'),
    ).toBeTruthy();
  });

  it('selectPath resolves false for a path that is not in the document', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const pluginList = plugins();
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

    const ok = await handle!.callCommand<Promise<boolean>>('selectPath', [
      'nope',
      'missing',
    ]);
    expect(ok).toBe(false);
  });

  it('clicking an ancestor crumb selects that ancestor', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const pluginList = plugins();
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

    await handle!.callCommand<Promise<boolean>>('selectPath', [
      'meta',
      'author',
      'email',
    ]);
    expect(crumbs()).toHaveLength(4);

    fireEvent.click(crumbs()[1]); // "meta"
    await Promise.resolve();

    const metaRow = document.querySelector(
      '[data-path=\'["meta"]\']',
    ) as HTMLElement;
    expect(document.activeElement).toBe(metaRow);
    expect(crumbs().map((c) => c.textContent)).toEqual(['root', 'meta']);
  });

  it('honours the tail stage', () => {
    const pluginList = plugins({ stage: 'tail' });
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={pluginList}
      />
    ));

    const nav = document.querySelector('.json-tree-breadcrumbs')!;
    const scroll = document.querySelector('.json-tree__scroll')!;
    expect(
      nav.compareDocumentPosition(scroll) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it('tracks focus even when the plugin list is built inline', async () => {
    // Inline lists re-run the factory on every props read. The install effect
    // untracks plugin setup, so nothing re-reads it and the installed instance
    // stays the rendered one.
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={3}
        plugins={[breadcrumbsPlugin()]}
      />
    ));

    const row = document.querySelector(
      '[data-path=\'["meta","author","email"]\']',
    ) as HTMLElement;
    fireEvent.focusIn(row);

    expect(crumbs().map((c) => c.textContent)).toEqual([
      'root',
      'meta',
      'author',
      'email',
    ]);
  });

  it('clears a pending flash ring when the plugin is torn down', async () => {
    let handle: JsonTreeViewHandle | undefined;
    const [enabled, setEnabled] = createSignal(true);
    const pluginList = plugins();

    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={enabled() ? pluginList : []}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    await handle!.callCommand<Promise<boolean>>('selectPath', ['items', 0]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.querySelector('.json-tree-flash-ring')).toBeTruthy();

    // Unregistering the plugin takes its decoration with it.
    setEnabled(false);
    expect(document.querySelector('.json-tree-flash-ring')).toBeNull();
    expect(handle!.hasCommand('selectPath')).toBe(false);
    expect(document.querySelector('.json-tree-breadcrumbs')).toBeNull();
  });

  it('a second selectPath registrant becomes a subordinate', () => {
    let handle: JsonTreeViewHandle | undefined;
    let role: string | undefined;
    const pluginList = plugins();
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

    handle!.use({
      name: 'other-nav',
      setup(ctx) {
        role = ctx.registerCommand('selectPath', () => 'nope').role;
      },
    });

    expect(role).toBe('subordinate');
  });
});
