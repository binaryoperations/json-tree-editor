import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NullEditor } from './NullEditor';

afterEach(() => cleanup());

describe('NullEditor', () => {
  it('opens an input on focus and commits parsed JSON on blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(() => <NullEditor onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: /null value/i }));
    const input = screen.getByLabelText('Null value editor') as HTMLInputElement;
    // Brackets are special in userEvent keyboard syntax — set value directly.
    fireEvent.input(input, { target: { value: '[1,2]' } });
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith([1, 2]);
  });

  it('commits empty draft as null', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(() => <NullEditor onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: /null value/i }));
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('commits unquoted text as a string', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(() => <NullEditor onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: /null value/i }));
    const input = screen.getByLabelText('Null value editor');
    await user.type(input, 'hello');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith('hello');
  });

  it('cancels on Escape without committing', () => {
    const onCommit = vi.fn();
    render(() => <NullEditor onCommit={onCommit} />);

    fireEvent.focus(screen.getByRole('button', { name: /null value/i }));
    const input = screen.getByLabelText('Null value editor');
    fireEvent.input(input, { target: { value: 'nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /null value/i })).toBeTruthy();
  });
});
