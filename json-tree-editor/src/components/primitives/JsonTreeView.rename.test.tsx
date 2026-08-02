import { cleanup, render, screen, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';

import { JsonTreeView } from './JsonTreeView';

afterEach(() => cleanup());

function TreeHarness(props: { initial: string }) {
  const [source, setSource] = createSignal(props.initial);

  return (
    <div>
      <div data-testid="source">{source()}</div>
      <JsonTreeView value={source()} onChange={setSource} />
    </div>
  );
}

describe('JsonTreeView key rename', () => {
  it('renames a root-level object key and updates the document source', async () => {
    const user = userEvent.setup();
    render(() => (
      <TreeHarness initial={'{\n  "name": "Sample",\n  "id": 1\n}'} />
    ));

    await user.click(screen.getByRole('button', { name: 'name' }));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, 'title');
    await user.tab();

    const source = screen.getByTestId('source').textContent ?? '';
    expect(JSON.parse(source)).toEqual({ title: 'Sample', id: 1 });
    expect(screen.getByRole('button', { name: 'title' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'name' })).toBeNull();
  });

  it('renames a nested object key', async () => {
    const user = userEvent.setup();
    render(() => (
      <TreeHarness
        initial={JSON.stringify(
          { meta: { createdAt: 't', author: 'a' } },
          null,
          2,
        )}
      />
    ));

    const metaRow = screen.getByText('meta').closest('[role="treeitem"]');
    expect(metaRow).toBeTruthy();
    const chevron = within(metaRow as HTMLElement).queryByLabelText('Expand');
    if (chevron) await user.click(chevron);

    await user.click(screen.getByRole('button', { name: 'createdAt' }));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, 'created');
    await user.tab();

    const source = screen.getByTestId('source').textContent ?? '';
    expect(JSON.parse(source)).toEqual({
      meta: { created: 't', author: 'a' },
    });
  });
});
