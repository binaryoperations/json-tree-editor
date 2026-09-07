import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  JsonTreeEditorPlugin,
  TransactionEvent,
} from '../../lib/editor-runtime/types';
import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from './JsonTreeView';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DOC = JSON.stringify({ name: 'Ada', count: 1 }, null, 2);

describe('JsonTreeView plugins integration', () => {
  it('UI edit → onTransaction with didEmit true and origin ui', async () => {
    const events: TransactionEvent[] = [];
    const onChange = vi.fn();
    const logger: JsonTreeEditorPlugin = {
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    };

    render(() => (
      <JsonTreeView
        value={DOC}
        onChange={onChange}
        plugins={[logger]}
        defaultExpandedDepth={1}
      />
    ));

    // Rename key via UI (structural edit with kind rename).
    const nameBtn = screen.getByRole('button', { name: 'name' });
    fireEvent.click(nameBtn);
    const input = screen.getByLabelText('Property key');
    fireEvent.input(input, { target: { value: 'title' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1];
    expect(last.didEmit).toBe(true);
    expect(last.tr.meta.origin).toBe('ui');
    expect(last.tr.meta.kind).toBe('rename');
  });

  it('stable plugin name does not re-setup on parent re-render', () => {
    const setups: number[] = [];
    const plugin: JsonTreeEditorPlugin = {
      name: 'stable',
      setup() {
        setups.push(1);
      },
    };

    const [tick, setTick] = createSignal(0);
    const [plugins] = createSignal([plugin]);

    render(() => {
      void tick(); // re-render trigger
      return (
        <JsonTreeView
          value={DOC}
          onChange={() => {}}
          plugins={plugins()}
        />
      );
    });

    expect(setups).toEqual([1]);
    setTick(1);
    setTick(2);
    expect(setups).toEqual([1]);
  });

  it('handle.use registers plugin and callCommand reaches master', () => {
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

    expect(handle).toBeDefined();
    expect(handle!.hasCommand('ping')).toBe(false);

    const dispose = handle!.use({
      name: 'cmd',
      setup(ctx) {
        ctx.registerCommand('ping', (x: unknown) => `pong:${String(x)}`);
      },
    });

    expect(handle!.hasCommand('ping')).toBe(true);
    expect(handle!.callCommand('ping', 'hi')).toBe('pong:hi');

    dispose();
    expect(handle!.hasCommand('ping')).toBe(false);
    expect(handle!.callCommand('ping')).toBeUndefined();
  });

  it('echo: controlled dual-pane loop does not fire host/external events', () => {
    // PRD §10.1 / §10.2 — host writes back last emit → silent for plugins.
    const events: TransactionEvent[] = [];
    const [value, setValue] = createSignal(DOC);
    const logger: JsonTreeEditorPlugin = {
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    };

    render(() => (
      <JsonTreeView
        value={value()}
        onChange={(next) => setValue(next)}
        plugins={[logger]}
        defaultExpandedDepth={1}
      />
    ));

    // Rename → onChange → setValue(emitted) → handleHostValue(echo).
    const nameBtn = screen.getByRole('button', { name: 'name' });
    fireEvent.click(nameBtn);
    const input = screen.getByLabelText('Property key');
    fireEvent.input(input, { target: { value: 'title' } });
    fireEvent.blur(input);

    expect(events.length).toBeGreaterThanOrEqual(1);
    // Controlled echo must not surface as host/external.
    expect(events.every((e) => e.tr.meta.origin === 'ui')).toBe(true);
    expect(events.every((e) => e.tr.meta.kind !== 'external')).toBe(true);
    expect(events.some((e) => e.didEmit)).toBe(true);
    // Source signal matches last UI emit.
    expect(JSON.parse(value())).toMatchObject({ title: 'Ada', count: 1 });
  });

  it('external host value change notifies plugins with didEmit false', () => {
    const events: TransactionEvent[] = [];
    const [value, setValue] = createSignal(DOC);
    const logger: JsonTreeEditorPlugin = {
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    };

    render(() => (
      <JsonTreeView
        value={value()}
        onChange={() => {}}
        plugins={[logger]}
      />
    ));

    events.length = 0;
    const external = JSON.stringify({ name: 'Grace', count: 2 }, null, 2);
    setValue(external);

    expect(events).toHaveLength(1);
    expect(events[0].didEmit).toBe(false);
    expect(events[0].tr.meta.origin).toBe('host');
    expect(events[0].tr.meta.kind).toBe('external');
  });
});
