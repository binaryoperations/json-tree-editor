import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KeyEditor } from './KeyEditor';

afterEach(() => cleanup());

describe('KeyEditor', () => {
  it('calls onRename with the trimmed new key on blur', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(() => <KeyEditor label="name" onRename={onRename} />);

    await user.click(screen.getByTitle('Click to rename key'));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, '  title  ');
    await user.tab();

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith('title');
  });

  it('calls onRename on Enter', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(() => <KeyEditor label="name" onRename={onRename} />);

    await user.click(screen.getByTitle('Click to rename key'));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, 'renamed{Enter}');

    expect(onRename).toHaveBeenCalledWith('renamed');
  });

  it('does not rename when the key is unchanged or empty', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(() => <KeyEditor label="name" onRename={onRename} />);

    await user.click(screen.getByTitle('Click to rename key'));
    await user.tab();
    expect(onRename).not.toHaveBeenCalled();

    await user.click(screen.getByTitle('Click to rename key'));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, '   ');
    await user.tab();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('cancels on Escape without renaming', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(() => <KeyEditor label="name" onRename={onRename} />);

    await user.click(screen.getByTitle('Click to rename key'));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, 'nope{Escape}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByTitle('Click to rename key').textContent).toBe('name');
  });

  it('shows updated label when parent prop changes after rename', async () => {
    const user = userEvent.setup();
    const [label, setLabel] = createSignal('name');
    render(() => (
      <KeyEditor
        label={label()}
        onRename={(next) => {
          setLabel(next);
        }}
      />
    ));

    await user.click(screen.getByTitle('Click to rename key'));
    const input = screen.getByLabelText('Property key');
    await user.clear(input);
    await user.type(input, 'title');
    await user.tab();

    expect(screen.getByTitle('Click to rename key').textContent).toBe('title');
  });

  it('does not lose the draft when commit toggles editing off (regression)', () => {
    // Reproduces the bug where setEditing(false) ran before reading draft,
    // and the sync effect reset draft back to the old label.
    const onRename = vi.fn();
    render(() => <KeyEditor label="name" onRename={onRename} />);

    fireEvent.click(screen.getByTitle('Click to rename key'));
    const input = screen.getByLabelText('Property key') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'title' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('title');
  });

  it('enters edit mode when autoEdit is set', () => {
    const onAutoEditStart = vi.fn();
    render(() => (
      <KeyEditor
        label="key"
        onRename={vi.fn()}
        autoEdit
        onAutoEditStart={onAutoEditStart}
      />
    ));

    expect(screen.getByLabelText('Property key')).toBeTruthy();
    expect(onAutoEditStart).toHaveBeenCalled();
  });
});
