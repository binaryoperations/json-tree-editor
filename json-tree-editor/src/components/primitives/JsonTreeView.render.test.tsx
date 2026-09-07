import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsonTreeEditorPlugin } from '../../lib/editor-runtime/types';
import { JsonTreeView, type JsonTreeViewHandle } from './JsonTreeView';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DOC = JSON.stringify({ name: 'Ada', nested: { deep: 1 } }, null, 2);

const bannerPlugin = (
  overrides: Partial<JsonTreeEditorPlugin> = {},
): JsonTreeEditorPlugin => ({
  name: 'banner',
  setup: () => {},
  render: (stage) => <div data-testid="banner">banner:{stage}</div>,
  ...overrides,
});

describe('JsonTreeView plugin render slots', () => {
  it('renders a plugin in the head slot by default, above the tree', () => {
    render(() => (
      <JsonTreeView value={DOC} onChange={() => {}} plugins={[bannerPlugin()]} />
    ));

    const banner = screen.getByTestId('banner');
    expect(banner.textContent).toBe('banner:head');

    const scroll = document.querySelector('.json-tree__scroll');
    expect(scroll).toBeTruthy();
    // head slot precedes the tree scroller in document order.
    expect(
      banner.compareDocumentPosition(scroll!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders a tail plugin after the tree scroller', () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={[bannerPlugin({ stage: 'tail' })]}
      />
    ));

    const banner = screen.getByTestId('banner');
    expect(banner.textContent).toBe('banner:tail');

    const scroll = document.querySelector('.json-tree__scroll');
    expect(
      banner.compareDocumentPosition(scroll!) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it('calls render once per plugin, not once per stage', () => {
    const render_ = vi.fn(
      (_stage: 'head' | 'tail') => <div data-testid="banner">x</div>,
    );
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={[bannerPlugin({ render: render_ })]}
      />
    ));

    expect(render_).toHaveBeenCalledTimes(1);
    expect(render_.mock.calls[0][0]).toBe('head');
  });

  it('a plugin without render contributes no UI', () => {
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={[{ name: 'headless', setup: () => {} }]}
      />
    ));
    expect(screen.queryByTestId('banner')).toBeNull();
  });

  it('a throwing render is isolated — the tree still renders', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={[
          bannerPlugin({
            render: () => {
              throw new Error('boom');
            },
          }),
        ]}
      />
    ));

    expect(document.querySelector('.json-tree__scroll')).toBeTruthy();
    expect(err).toHaveBeenCalled();
  });

  it('plugins installed via handle.use() also render, and unmount on dispose', () => {
    let handle: JsonTreeViewHandle | undefined;
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    expect(screen.queryByTestId('banner')).toBeNull();
    const dispose = handle!.use(bannerPlugin());
    expect(screen.getByTestId('banner')).toBeTruthy();

    dispose();
    expect(screen.queryByTestId('banner')).toBeNull();
  });

  it('plugin setup does not leak into the install effect (no re-read on focus)', () => {
    let reads = 0;
    const list: JsonTreeEditorPlugin[] = [
      {
        name: 'probe',
        // Reads editor state during setup, like breadcrumbsPlugin does.
        setup: (ctx) => {
          ctx.callCommand('json-tree.getFocusedPath');
        },
      },
    ];
    const readList = () => {
      reads += 1;
      return list;
    };

    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        defaultExpandedDepth={3}
        plugins={readList()}
      />
    ));
    expect(reads).toBe(1);

    const row = document.querySelector(
      '[data-path=\'["nested","deep"]\']',
    ) as HTMLElement;
    fireEvent.focusIn(row);
    // Focus is not a plugin-set dependency — no reinstall, no re-read.
    expect(reads).toBe(1);
  });

  it('renders the imperatively installed instance when a name arrives twice', () => {
    let handle: JsonTreeViewHandle | undefined;
    const declared = bannerPlugin({
      render: () => <div data-testid="banner">declared</div>,
    });
    const list = [declared];

    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        plugins={list}
        ref={(h) => {
          handle = h;
        }}
      />
    ));
    expect(screen.getByTestId('banner').textContent).toBe('declared');

    // Same name via use(): setPlugins keeps the first-installed instance, so
    // the declared one is never set up — render the live one instead.
    handle!.use(
      bannerPlugin({ render: () => <div data-testid="banner">imperative</div> }),
    );
    expect(screen.getAllByTestId('banner')).toHaveLength(1);
  });

  it('view primitives are not registered until a plugin is installed', () => {
    let handle: JsonTreeViewHandle | undefined;
    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={() => {}}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    expect(handle!.hasCommand('json-tree.revealPath')).toBe(false);
    handle!.use({ name: 'noop', setup: () => {} });
    expect(handle!.hasCommand('json-tree.revealPath')).toBe(true);
    expect(handle!.hasCommand('json-tree.expandPath')).toBe(true);
    expect(handle!.hasCommand('json-tree.getFocusedPath')).toBe(true);
  });
});
