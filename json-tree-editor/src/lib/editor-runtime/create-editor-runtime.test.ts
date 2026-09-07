import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEditorRuntime } from './create-editor-runtime';
import type {
  JsonTreeEditorPlugin,
  TransactionEvent,
} from './types';

afterEach(() => {
  vi.restoreAllMocks();
});

function runtime(opts?: {
  initialValue?: string;
  onChange?: (s: string) => void;
  readOnly?: boolean;
}) {
  const onChange = opts?.onChange ?? vi.fn();
  const rt = createEditorRuntime({
    initialValue: opts?.initialValue ?? '{\n  "a": 1\n}',
    onChange,
    readOnly: opts?.readOnly,
  });
  return { rt, onChange };
}

describe('createEditorRuntime — dispatch XOR / shape', () => {
  it('rejects when both nextRoot and nextValue are set', () => {
    const { rt, onChange } = runtime();
    const ok = rt.dispatch({
      nextRoot: { a: 2 },
      nextValue: '{"a":2}',
      meta: {
        origin: 'ui',
        kind: 'set-value',
        skipHistory: false,
        echo: false,
      },
    });
    expect(ok).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects when neither nextRoot nor nextValue is set', () => {
    const { rt, onChange } = runtime();
    const ok = rt.dispatch({
      meta: {
        origin: 'ui',
        kind: 'unknown',
        skipHistory: false,
        echo: false,
      },
    });
    expect(ok).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts nextRoot only and emits pretty JSON', () => {
    const { rt, onChange } = runtime();
    const ok = rt.commitUi({ a: 2 }, { kind: 'set-value' });
    expect(ok).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(JSON.stringify({ a: 2 }, null, 2));
    expect(rt.getValue()).toBe(JSON.stringify({ a: 2 }, null, 2));
  });

  it('accepts nextValue only', () => {
    const { rt, onChange } = runtime();
    const next = '{\n  "b": 3\n}';
    const ok = rt.dispatch({
      nextValue: next,
      meta: {
        origin: 'plugin',
        kind: 'plugin',
        skipHistory: false,
        echo: false,
      },
    });
    expect(ok).toBe(true);
    expect(onChange).toHaveBeenCalledWith(next);
  });

  it('no-ops when resolved string equals current value', () => {
    const initial = JSON.stringify({ a: 1 }, null, 2);
    const { rt, onChange } = runtime({ initialValue: initial });
    const ok = rt.commitUi({ a: 1 }, { kind: 'set-value' });
    expect(ok).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('createEditorRuntime — readOnly', () => {
  it('rejects doc dispatch when readOnly', () => {
    const { rt, onChange } = runtime({ readOnly: true });
    expect(rt.commitUi({ a: 9 })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('setReadOnly(true) blocks subsequent commits', () => {
    const { rt, onChange } = runtime();
    rt.setReadOnly(true);
    expect(rt.commitUi({ a: 9 })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('createEditorRuntime — lastEmitted / host value', () => {
  it('echo: host sets value to last emit → no onChange, no plugin event', () => {
    const events: TransactionEvent[] = [];
    const { rt, onChange } = runtime();
    rt.use({
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    });

    rt.commitUi({ a: 2 }, { kind: 'set-value' });
    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = (onChange as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    events.length = 0;

    rt.handleHostValue(emitted);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(0);
  });

  it('external: host sets different value → onTransaction host/external didEmit false', () => {
    const events: TransactionEvent[] = [];
    const { rt, onChange } = runtime({
      initialValue: JSON.stringify({ a: 1 }, null, 2),
    });
    rt.use({
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    });

    const external = JSON.stringify({ a: 99 }, null, 2);
    rt.handleHostValue(external);

    expect(onChange).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0].didEmit).toBe(false);
    expect(events[0].tr.meta.origin).toBe('host');
    expect(events[0].tr.meta.kind).toBe('external');
    expect(events[0].value).toBe(external);
    expect(rt.getValue()).toBe(external);
  });

  it('first mount: no phantom external event', () => {
    const events: TransactionEvent[] = [];
    const initial = JSON.stringify({ a: 1 }, null, 2);
    const { rt } = runtime({ initialValue: initial });
    rt.use({
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    });
    // Same as initial — baseline, not external.
    rt.handleHostValue(initial);
    expect(events).toHaveLength(0);
  });
});

describe('createEditorRuntime — thin vs full', () => {
  it('stays thin until first plugin', () => {
    const { rt } = runtime();
    expect(rt.isFull()).toBe(false);
    rt.commitUi({ a: 2 });
    expect(rt.isFull()).toBe(false);
    rt.use({
      name: 'p',
      setup() {
        /* empty */
      },
    });
    expect(rt.isFull()).toBe(true);
  });

  it('setPlugins([]) on thin path does not promote', () => {
    const { rt } = runtime();
    rt.setPlugins([]);
    expect(rt.isFull()).toBe(false);
  });

  it('thin path: many commits on large doc stay thin (no registry promote)', () => {
    // PRD §10.9 — no plugins → no registry/listener cost on large-tree smoke.
    const big: Record<string, unknown> = {};
    for (let i = 0; i < 2_000; i += 1) {
      big[`k${i}`] = { n: i, tags: ['a', 'b', 'c'] };
    }
    const initial = JSON.stringify(big, null, 2);
    const { rt, onChange } = runtime({ initialValue: initial });

    expect(rt.isFull()).toBe(false);
    for (let i = 0; i < 50; i += 1) {
      const next = { ...big, __tick: i };
      expect(rt.commitUi(next, { kind: 'set-value' })).toBe(true);
    }
    expect(rt.isFull()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(50);
    // Commands API is a no-op shell on thin path.
    expect(rt.hasCommand('undo')).toBe(false);
    expect(rt.callCommand('undo')).toBeUndefined();
  });

  it('UI commit on full path notifies with didEmit true and origin ui', () => {
    const events: TransactionEvent[] = [];
    const { rt } = runtime();
    rt.use({
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
      },
    });
    rt.commitUi({ a: 5 }, { kind: 'add', path: ['a'] });
    expect(events).toHaveLength(1);
    expect(events[0].didEmit).toBe(true);
    expect(events[0].tr.meta.origin).toBe('ui');
    expect(events[0].tr.meta.kind).toBe('add');
  });

  it('notifies plugins before host onChange (sync order)', () => {
    const order: string[] = [];
    const { rt } = runtime({
      onChange: () => {
        order.push('onChange');
      },
    });
    rt.use({
      name: 'logger',
      setup(ctx) {
        ctx.onTransaction(() => {
          order.push('notify');
        });
      },
    });
    rt.commitUi({ a: 5 }, { kind: 'set-value', path: ['a'] });
    expect(order).toEqual(['notify', 'onChange']);
  });
});

describe('createEditorRuntime — commands', () => {
  it('first registrant is master; only master serves callCommand', () => {
    const { rt } = runtime();
    const first = vi.fn(() => 'first');
    const second = vi.fn(() => 'second');

    rt.use({
      name: 'history',
      setup(ctx) {
        ctx.registerCommand('undo', first);
      },
    });
    rt.use({
      name: 'collab',
      setup(ctx) {
        ctx.registerCommand('undo', second);
      },
    });

    expect(rt.callCommand('undo')).toBe('first');
    expect(first).toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(rt.hasCommand('undo')).toBe(true);
  });

  it('exclusive subordinate → console.error once; master continues', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rt } = runtime();
    const master = vi.fn(() => true);
    const onSub = vi.fn();

    rt.use({
      name: 'history',
      setup(ctx) {
        ctx.registerCommand('undo', master, { exclusive: true });
      },
    });
    rt.use({
      name: 'collab',
      setup(ctx) {
        const result = ctx.registerCommand('undo', () => false, {
          exclusive: true,
          onBecomeSubordinate: onSub,
        });
        expect(result.role).toBe('subordinate');
        expect(result.masterPluginName).toBe('history');
      },
    });

    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toMatch(/exclusive command "undo"/);
    expect(onSub).toHaveBeenCalledWith({
      command: 'undo',
      masterPluginName: 'history',
    });
    expect(rt.callCommand('undo')).toBe(true);
  });

  it('master teardown removes command (no promote)', () => {
    const { rt } = runtime();
    const disposeHistory = rt.use({
      name: 'history',
      setup(ctx) {
        ctx.registerCommand('undo', () => true, { exclusive: true });
      },
    });
    rt.use({
      name: 'collab',
      setup(ctx) {
        ctx.registerCommand('undo', () => 'promoted?');
      },
    });

    expect(rt.hasCommand('undo')).toBe(true);
    disposeHistory();
    expect(rt.hasCommand('undo')).toBe(false);
    expect(rt.callCommand('undo')).toBeUndefined();
  });

  it('missing command: callCommand undefined, hasCommand false', () => {
    const { rt } = runtime();
    expect(rt.hasCommand('nope')).toBe(false);
    expect(rt.callCommand('nope')).toBeUndefined();
  });
});

describe('createEditorRuntime — setValue sugar', () => {
  it('setValue only goes through dispatch', () => {
    // PRD §10.7 / FR-2 — setValue is sugar: string→nextValue, object→nextRoot,
    // origin plugin, didEmit true. Observes the funnel via onTransaction.
    const events: TransactionEvent[] = [];
    const { rt, onChange } = runtime();

    rt.use({
      name: 'driver',
      setup(ctx) {
        ctx.onTransaction((e) => {
          events.push(e);
        });
        expect(ctx.setValue('{\n  "x": 1\n}')).toBe(true);
        expect(ctx.setValue({ x: 2 })).toBe(true);
      },
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(2);
    expect(events[0].tr.meta.origin).toBe('plugin');
    expect(events[0].tr.meta.kind).toBe('plugin');
    expect(events[0].didEmit).toBe(true);
    expect(events[0].tr.nextValue).toBeDefined();
    expect(events[0].tr.nextRoot).toBeUndefined();
    expect(events[1].tr.nextRoot).toBeDefined();
    expect(events[1].tr.nextValue).toBeUndefined();
    expect(events[1].didEmit).toBe(true);
  });
});

describe('createEditorRuntime — re-entry depth', () => {
  it('queues re-entrant dispatch from onTransaction and flushes', () => {
    const values: string[] = [];
    const { rt } = runtime({
      initialValue: JSON.stringify({ n: 0 }, null, 2),
      onChange: (s) => {
        values.push(s);
      },
    });

    rt.use({
      name: 'chain',
      setup(ctx) {
        let hops = 0;
        ctx.onTransaction(() => {
          hops += 1;
          if (hops < 3) {
            ctx.setValue({ n: hops });
          }
        });
      },
    });

    // Force a first change from UI; plugin re-enters twice (hops 1→2).
    expect(rt.commitUi({ n: -1 }, { kind: 'set-value' })).toBe(true);

    // Initial commit + 2 re-entrant setValues → n ends at 2.
    expect(values).toHaveLength(3);
    expect(values.map((s) => JSON.parse(s).n)).toEqual([-1, 1, 2]);
  });

  it('drops queue when re-entry depth exceeds 8', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rt } = runtime({
      initialValue: JSON.stringify({ n: 0 }, null, 2),
    });

    rt.use({
      name: 'bomb',
      setup(ctx) {
        let n = 0;
        ctx.onTransaction(() => {
          n += 1;
          // Always re-enter — depth guard should trip.
          ctx.setValue({ n });
        });
      },
    });

    rt.commitUi({ n: -1 }, { kind: 'set-value' });
    expect(err).toHaveBeenCalled();
    expect(
      err.mock.calls.some((c) =>
        String(c[0]).includes('re-entry depth exceeded'),
      ),
    ).toBe(true);
  });
});

describe('createEditorRuntime — plugin lifecycle', () => {
  it('duplicate plugin name skips second setup', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setups: string[] = [];
    const { rt } = runtime();
    const plugin: JsonTreeEditorPlugin = {
      name: 'dup',
      setup() {
        setups.push('setup');
      },
    };
    rt.use(plugin);
    rt.use(plugin);
    expect(setups).toEqual(['setup']);
    expect(err).toHaveBeenCalled();
  });

  it('setPlugins keeps same name without re-setup', () => {
    const setups: number[] = [];
    const { rt } = runtime();
    const make = (label: string): JsonTreeEditorPlugin => ({
      name: 'stable',
      setup() {
        setups.push(1);
        void label;
      },
    });
    rt.setPlugins([make('a')]);
    rt.setPlugins([make('b')]); // new object, same name
    expect(setups).toEqual([1]);
  });

  it('setPlugins tears down removed names', () => {
    const disposed: string[] = [];
    const { rt } = runtime();
    rt.setPlugins([
      {
        name: 'a',
        setup() {
          return () => disposed.push('a');
        },
      },
      {
        name: 'b',
        setup() {
          return () => disposed.push('b');
        },
      },
    ]);
    rt.setPlugins([
      {
        name: 'b',
        setup() {
          /* should not re-run */
        },
      },
    ]);
    expect(disposed).toEqual(['a']);
  });

  it('dispose tears down plugins and removes commands', () => {
    const disposed: string[] = [];
    const { rt } = runtime();
    rt.use({
      name: 'p',
      setup(ctx) {
        ctx.registerCommand('undo', () => true);
        return () => disposed.push('p');
      },
    });
    expect(rt.hasCommand('undo')).toBe(true);
    rt.dispose();
    expect(disposed).toEqual(['p']);
    expect(rt.hasCommand('undo')).toBe(false);
    expect(rt.commitUi({ a: 1 })).toBe(false);
  });
});
