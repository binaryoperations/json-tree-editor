import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NumberEditor } from './NumberEditor';

afterEach(() => cleanup());

describe('NumberEditor', () => {
  it('live-commits complete numbers on input without blur', () => {
    const onCommit = vi.fn();
    render(() => <NumberEditor value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '11' } });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(11, expect.objectContaining({
      sessionId: expect.any(String),
    }));
    // Commit happened on input alone — blur would be a second path.
  });

  it('does not commit incomplete drafts (no NaN / partial numbers)', () => {
    const onCommit = vi.fn();
    render(() => <NumberEditor value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);

    for (const incomplete of ['', '-', '1.', '1e', '1e-']) {
      onCommit.mockClear();
      fireEvent.input(input, { target: { value: incomplete } });
      expect(onCommit, incomplete).not.toHaveBeenCalled();
      expect(input.value).toBe(incomplete);
    }
  });

  it('does not re-commit when the complete text equals props.value', () => {
    const onCommit = vi.fn();
    render(() => <NumberEditor value={42} onCommit={onCommit} />);

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '42' } });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps scientific draft free after live-commit (no mid-type normalize)', () => {
    const [value, setValue] = createSignal(1);
    render(() => (
      <NumberEditor
        value={value()}
        onCommit={(next) => setValue(next)}
      />
    ));

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);
    // "1e2" is complete → commits 100, but draft must stay "1e2"
    fireEvent.input(input, { target: { value: '1e2' } });

    expect(value()).toBe(100);
    expect(input.value).toBe('1e2');

    // User can continue typing without the field jumping to "100"
    fireEvent.input(input, { target: { value: '1e23' } });
    expect(value()).toBe(1e23);
    expect(input.value).toBe('1e23');
  });

  it('normalizes draft on blur and reverts incomplete', () => {
    const [value, setValue] = createSignal(1);
    render(() => (
      <NumberEditor
        value={value()}
        onCommit={(next) => setValue(next)}
      />
    ));

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '1e2' } });
    expect(input.value).toBe('1e2');
    fireEvent.blur(input);
    expect(value()).toBe(100);
    expect(
      (screen.getByLabelText('Number value') as HTMLInputElement).value,
    ).toBe('100');

    // Incomplete → revert to current value
    const input2 = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input2);
    fireEvent.input(input2, { target: { value: '1e' } });
    expect(value()).toBe(100); // no live commit
    fireEvent.blur(input2);
    expect(value()).toBe(100);
    expect(
      (screen.getByLabelText('Number value') as HTMLInputElement).value,
    ).toBe('100');
  });

  it('resyncs focused draft when props.value changes externally (undo)', () => {
    const [value, setValue] = createSignal(10);
    render(() => (
      <NumberEditor
        value={value()}
        onCommit={(next) => setValue(next)}
      />
    ));

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '11' } });
    expect(value()).toBe(11);
    expect(input.value).toBe('11');

    // Simulate history undo while still focused
    setValue(10);
    expect(input.value).toBe('10');
  });

  it('passes a stable sessionId across live commits in one focus session', () => {
    const onCommit = vi.fn();
    render(() => <NumberEditor value={0} onCommit={onCommit} />);

    const input = screen.getByLabelText('Number value') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '1' } });
    fireEvent.input(input, { target: { value: '12' } });

    expect(onCommit).toHaveBeenCalledTimes(2);
    const sid1 = onCommit.mock.calls[0][1]?.sessionId;
    const sid2 = onCommit.mock.calls[1][1]?.sessionId;
    expect(sid1).toEqual(expect.any(String));
    expect(sid2).toBe(sid1);
  });
});
