import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEditorRuntime } from '../lib/editor-runtime/create-editor-runtime';
import { buildCommitMeta } from '../lib/editor-runtime/meta';
import type { TransactionEvent } from '../lib/editor-runtime/types';
import { stringifyJsonDocument } from '../lib/parse-json';
import {
  JsonTreeView,
  type JsonTreeViewHandle,
} from '../components/primitives/JsonTreeView';
import { StringEditor } from '../components/primitives/StringEditor';
import { buildHistoryEntry, historyPlugin } from './history-plugin';
import { approxJsonBytes, createPathStack, recordEntry } from './path-stack';
import type { HistoryReadSnapshot } from './types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Minimal TransactionEvent for buildHistoryEntry unit tests. */
function fakeTx(
  partial: {
    kind: TransactionEvent['tr']['meta']['kind'];
    path?: TransactionEvent['tr']['meta']['path'];
    origin?: TransactionEvent['tr']['meta']['origin'];
    coalesceKey?: string;
    toKey?: string;
    fromIndex?: number;
    toIndex?: number;
    newPath?: TransactionEvent['tr']['meta']['newPath'];
    newKey?: string;
    newIndex?: number;
    skipHistory?: boolean;
    echo?: boolean;
    nextRoot?: unknown;
    value?: string;
    prevValue?: string;
  },
): TransactionEvent {
  const origin = partial.origin ?? 'ui';
  const meta = buildCommitMeta(origin, {
    kind: partial.kind,
    path: partial.path,
    coalesceKey: partial.coalesceKey,
    toKey: partial.toKey,
    fromIndex: partial.fromIndex,
    toIndex: partial.toIndex,
    newPath: partial.newPath,
    newKey: partial.newKey,
    newIndex: partial.newIndex,
    skipHistory: partial.skipHistory,
    echo: partial.echo,
  });
  const value = partial.value ?? '{}';
  return {
    tr: {
      nextRoot: partial.nextRoot,
      meta,
    },
    value,
    prevValue: partial.prevValue ?? '{}',
    didEmit: true,
    state: {
      value,
      root: {},
      validity: { ok: true, pretty: value, value: {} },
      readOnly: false,
    },
  };
}

describe('historyPlugin + createEditorRuntime', () => {
  it('records path-replace and undoes/redoes without full-doc entries', () => {
    const onChange = vi.fn();
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ a: 'x', pad: 'y'.repeat(100) }),
      onChange,
    });
    rt.setRootProvider(() => {
      try {
        return JSON.parse(rt.getValue()) as Record<string, unknown>;
      } catch {
        return {};
      }
    });
    rt.setPlugins([historyPlugin({ maxDepth: 50 })]);

    expect(rt.callCommand<boolean>('canUndo')).toBe(false);

    rt.commitUi({ a: 'hello', pad: 'y'.repeat(100) }, {
      kind: 'set-value',
      path: ['a'],
      coalesceKey: 'set-value:a:sess1',
    });

    expect(rt.callCommand<boolean>('canUndo')).toBe(true);
    const hist = rt.callCommand<HistoryReadSnapshot>('readHistory');
    expect(hist?.undoDepth).toBe(1);
    expect(hist?.backend).toBe('local-path-stack');
    // Leaf payload ≪ full document
    const full = rt.getValue().length;
    expect(hist!.approxBytes).toBeLessThan(full);

    expect(rt.callCommand<boolean>('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({
      a: 'x',
      pad: 'y'.repeat(100),
    });
    expect(rt.callCommand<boolean>('canRedo')).toBe(true);

    expect(rt.callCommand<boolean>('redo')).toBe(true);
    expect(JSON.parse(rt.getValue()).a).toBe('hello');
  });

  it('coalesces string session keystrokes into one undo step', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ a: '' }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin()]);

    const key = 'set-value:a:s1';
    for (const after of ['h', 'he', 'hel', 'hello']) {
      const prev = JSON.parse(rt.getValue()) as { a: string };
      rt.commitUi({ a: after }, {
        kind: 'set-value',
        path: ['a'],
        coalesceKey: key,
      });
      void prev;
    }

    const hist = rt.callCommand<HistoryReadSnapshot>('readHistory');
    expect(hist?.undoDepth).toBe(1);

    rt.callCommand('undo');
    expect(JSON.parse(rt.getValue())).toEqual({ a: '' });
  });

  it('external clear (default) wipes stacks; echo does not record', () => {
    let value = stringifyJsonDocument({ a: 1 });
    const rt = createEditorRuntime({
      initialValue: value,
      onChange: (s) => {
        value = s;
      },
    });
    rt.setPlugins([historyPlugin()]);

    rt.commitUi({ a: 2 }, { kind: 'set-value', path: ['a'] });
    expect(rt.callCommand<boolean>('canUndo')).toBe(true);

    // Echo of last emit — silent, no clear
    rt.handleHostValue(value);
    expect(rt.callCommand<boolean>('canUndo')).toBe(true);

    // True external rewrite
    rt.handleHostValue(stringifyJsonDocument({ a: 99 }));
    expect(rt.callCommand<boolean>('canUndo')).toBe(false);
  });

  it('externalPolicy skip keeps stacks', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ a: 1 }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin({ externalPolicy: 'skip' })]);

    rt.commitUi({ a: 2 }, { kind: 'set-value', path: ['a'] });
    expect(rt.callCommand<boolean>('canUndo')).toBe(true);

    rt.handleHostValue(stringifyJsonDocument({ a: 99 }));
    // stacks kept; undo may fail continuity
    expect(rt.callCommand<boolean>('canUndo')).toBe(true);
    expect(rt.callCommand<boolean>('undo')).toBe(false);
  });

  it('array mid-delete undo inserts via plugin', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ list: ['a', 'b', 'c'] }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin()]);

    rt.commitUi({ list: ['a', 'c'] }, {
      kind: 'delete',
      path: ['list', 1],
    });
    expect(rt.callCommand('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({ list: ['a', 'b', 'c'] });
  });

  it('rename / add use enriched meta', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ old: 1 }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin()]);

    rt.commitUi({ neu: 1 }, {
      kind: 'rename',
      path: ['old'],
      toKey: 'neu',
    });
    expect(rt.callCommand('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({ old: 1 });

    rt.commitUi({ old: 1, k: null }, {
      kind: 'add',
      path: [],
      newPath: ['k'],
      newKey: 'k',
    });
    expect(rt.callCommand('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({ old: 1 });
  });

  it('reorder uses fromIndex/toIndex', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ list: [1, 2, 3] }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin()]);

    rt.commitUi({ list: [2, 3, 1] }, {
      kind: 'reorder',
      path: ['list'],
      fromIndex: 0,
      toIndex: 2,
    });
    expect(rt.callCommand('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({ list: [1, 2, 3] });
  });

  it('type-change and clear undo correctly (path-replace)', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ n: 1, keep: true }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin()]);

    rt.commitUi({ n: '1', keep: true }, {
      kind: 'type-change',
      path: ['n'],
    });
    expect(rt.callCommand('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({ n: 1, keep: true });

    rt.commitUi({ n: {}, keep: true }, {
      kind: 'clear',
      path: ['n'],
    });
    expect(JSON.parse(rt.getValue()).n).toEqual({});
    expect(rt.callCommand('undo')).toBe(true);
    expect(JSON.parse(rt.getValue())).toEqual({ n: 1, keep: true });
  });

  it('continuity drift: undo returns false and stacks stay intact', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ a: 1 }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin({ externalPolicy: 'skip' })]);

    rt.commitUi({ a: 2 }, { kind: 'set-value', path: ['a'] });
    expect(rt.callCommand<boolean>('canUndo')).toBe(true);
    const before = rt.callCommand<HistoryReadSnapshot>('readHistory');
    expect(before?.undoDepth).toBe(1);

    // Drift document without clearing history
    rt.handleHostValue(stringifyJsonDocument({ a: 99 }));
    expect(rt.callCommand<boolean>('undo')).toBe(false);
    const after = rt.callCommand<HistoryReadSnapshot>('readHistory');
    expect(after?.undoDepth).toBe(1);
    expect(after?.redoDepth).toBe(0);
  });

  it('skipHistory and clearHistory', () => {
    const rt = createEditorRuntime({
      initialValue: stringifyJsonDocument({ a: 1 }),
      onChange: () => {},
    });
    rt.setPlugins([historyPlugin()]);

    rt.commitUi({ a: 2 }, {
      kind: 'set-value',
      path: ['a'],
      skipHistory: true,
    });
    expect(rt.callCommand<boolean>('canUndo')).toBe(false);

    rt.commitUi({ a: 3 }, { kind: 'set-value', path: ['a'] });
    expect(rt.callCommand<boolean>('canUndo')).toBe(true);
    rt.callCommand('clearHistory');
    expect(rt.callCommand<boolean>('canUndo')).toBe(false);
  });

  it('subordinate history is inert (exclusive commands)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rt = createEditorRuntime({
      initialValue: '{}',
      onChange: () => {},
    });
    const master = historyPlugin();
    const subordinate = historyPlugin();
    rt.setPlugins([master, subordinate]);
    // First registration is master; second becomes subordinate and logs.
    expect(err).toHaveBeenCalled();
  });
});

describe('historyPlugin + JsonTreeView integration', () => {
  const DOC = JSON.stringify({ name: 'Ada', count: 1 }, null, 2);

  it('UI rename undoes via callCommand', async () => {
    const [value, setValue] = createSignal(DOC);
    let handle: JsonTreeViewHandle | undefined;

    render(() => (
      <JsonTreeView
        value={value()}
        onChange={setValue}
        plugins={[historyPlugin()]}
        defaultExpandedDepth={1}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    const nameBtn = screen.getByRole('button', { name: 'name' });
    fireEvent.click(nameBtn);
    const input = screen.getByLabelText('Property key');
    fireEvent.input(input, { target: { value: 'title' } });
    fireEvent.blur(input);

    expect(JSON.parse(value())).toHaveProperty('title');
    expect(handle!.callCommand<boolean>('canUndo')).toBe(true);
    expect(handle!.callCommand<boolean>('undo')).toBe(true);
    // Host must echo for controlled value — simulate dual-pane
    // onChange already setValue; undo also setValue via plugin → onChange
    expect(JSON.parse(value())).toHaveProperty('name');
  });

  it('source external keystroke clears tree history (dual-pane default)', () => {
    const [value, setValue] = createSignal(DOC);
    let handle: JsonTreeViewHandle | undefined;

    render(() => (
      <JsonTreeView
        value={value()}
        onChange={setValue}
        plugins={[historyPlugin()]}
        defaultExpandedDepth={1}
        ref={(h) => {
          handle = h;
        }}
      />
    ));

    // Tree edit
    const nameBtn = screen.getByRole('button', { name: 'name' });
    fireEvent.click(nameBtn);
    const input = screen.getByLabelText('Property key');
    fireEvent.input(input, { target: { value: 'title' } });
    fireEvent.blur(input);
    expect(handle!.callCommand<boolean>('canUndo')).toBe(true);

    // Host source pane rewrite (not echo)
    setValue(JSON.stringify({ name: 'Bob', count: 1 }, null, 2));
    expect(handle!.callCommand<boolean>('canUndo')).toBe(false);
  });

  it('focused string draft resyncs when props.value changes (history undo)', () => {
    // PRD §10.6 / C0.2 — focused draft must track external/history apply.
    const [value, setValue] = createSignal('hello');
    render(() => (
      <StringEditor value={value()} onCommit={(next) => setValue(next)} />
    ));

    const input = screen.getByLabelText('String value') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: 'hello!!' } });
    expect(value()).toBe('hello!!');
    expect(input.value).toBe('hello!!');

    // Simulate undo / host apply while still focused (props must actually change)
    setValue('hello');
    expect(input.value).toBe('hello');
  });
});

describe('buildHistoryEntry (IR product law)', () => {
  it('leaf set-value stores only subtree before/after — never full doc', () => {
    const pad = 'y'.repeat(500);
    const beforeRoot = { a: 'x', pad };
    const afterRoot = { a: 'hello', pad };
    const entry = buildHistoryEntry(
      fakeTx({
        kind: 'set-value',
        path: ['a'],
        coalesceKey: 'set-value:a:sess1',
        nextRoot: afterRoot,
      }),
      beforeRoot,
      afterRoot,
    );
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe('path-replace');
    if (entry!.kind === 'path-replace') {
      expect(entry!.before).toBe('x');
      expect(entry!.after).toBe('hello');
      expect(entry!.before).not.toEqual(beforeRoot);
      expect(entry!.after).not.toEqual(afterRoot);
      // Not full-document strings either
      expect(typeof entry!.before).not.toBe('object');
      expect(approxJsonBytes(entry!.before) + approxJsonBytes(entry!.after)).toBeLessThan(
        approxJsonBytes(beforeRoot) * 0.2,
      );
    }

    // Stack IR matches: recordEntry clones leaf only
    const stack = createPathStack();
    recordEntry(stack, entry!, beforeRoot);
    const top = stack.undo[0];
    expect(top.kind).toBe('path-replace');
    if (top.kind === 'path-replace') {
      expect(top.before).toBe('x');
      expect(top.after).toBe('hello');
    }
  });

  it('external / plugin-without-path never produce full-doc entries', () => {
    const root = { a: 1, big: 'z'.repeat(200) };
    expect(
      buildHistoryEntry(
        fakeTx({ kind: 'external', origin: 'host', nextRoot: root }),
        root,
        { a: 99, big: 'z'.repeat(200) },
      ),
    ).toBeNull();

    expect(
      buildHistoryEntry(
        fakeTx({ kind: 'plugin', origin: 'plugin', nextRoot: root }),
        root,
        root,
      ),
    ).toBeNull();

    expect(
      buildHistoryEntry(
        fakeTx({ kind: 'unknown', nextRoot: root }),
        root,
        root,
      ),
    ).toBeNull();
  });

  it('type-change and clear build path-replace at node path', () => {
    const beforeRoot = { n: 1, keep: true };
    const afterType = { n: '1', keep: true };
    const typeEntry = buildHistoryEntry(
      fakeTx({
        kind: 'type-change',
        path: ['n'],
        nextRoot: afterType,
      }),
      beforeRoot,
      afterType,
    );
    expect(typeEntry?.kind).toBe('path-replace');
    if (typeEntry?.kind === 'path-replace') {
      expect(typeEntry.path).toEqual(['n']);
      expect(typeEntry.before).toBe(1);
      expect(typeEntry.after).toBe('1');
      expect(typeEntry.commitKind).toBe('type-change');
    }

    const afterClear = { n: {}, keep: true };
    const clearEntry = buildHistoryEntry(
      fakeTx({
        kind: 'clear',
        path: ['n'],
        nextRoot: afterClear,
      }),
      afterType,
      afterClear,
    );
    expect(clearEntry?.kind).toBe('path-replace');
    if (clearEntry?.kind === 'path-replace') {
      expect(clearEntry.path).toEqual(['n']);
      expect(clearEntry.before).toBe('1');
      expect(clearEntry.after).toEqual({});
      expect(clearEntry.commitKind).toBe('clear');
    }
  });
});
