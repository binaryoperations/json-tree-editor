import { describe, expect, it } from 'vitest';

import {
  applyRedo,
  applyUndo,
  approxJsonBytes,
  canRedo,
  canUndo,
  clearPathStack,
  createPathStack,
  deepEqualJson,
  makePathAdd,
  makePathRemove,
  makePathRename,
  makePathReorder,
  makePathReplace,
  materializeEntry,
  planUndo,
  readHistory,
  recordEntry,
} from './path-stack';

describe('deepEqualJson', () => {
  it('compares by JSON value, not reference', () => {
    expect(deepEqualJson({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqualJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqualJson([1, 2], [1, 2])).toBe(true);
    expect(deepEqualJson(null, null)).toBe(true);
    expect(deepEqualJson(1, 1)).toBe(true);
    expect(deepEqualJson('x', 'x')).toBe(true);
  });
});

describe('path-stack record + coalesce', () => {
  it('refuses_to_coalesce_without_session_segment (bare set-value:path keys)', () => {
    const stack = createPathStack();
    const root0 = { a: 'x' };
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 'x',
        after: 'y',
        coalesceKey: 'set-value:a', // bare — no session id
        origin: 'ui',
        commitKind: 'set-value',
      }),
      root0,
    );
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 'y',
        after: 'z',
        coalesceKey: 'set-value:a',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 'y' },
    );
    expect(stack.undo).toHaveLength(2);
  });

  it('pushes replace and clears redo', () => {
    const stack = createPathStack({ maxDepth: 10 });
    const root0 = { a: 'hi' };
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 'hi',
        after: 'hello',
        coalesceKey: 'set-value:a:s1',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      root0,
    );
    expect(stack.undo).toHaveLength(1);
    expect(canUndo(stack)).toBe(true);
    expect(canRedo(stack)).toBe(false);

    // second different key → new entry
    const root1 = { a: 'hello' };
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 'hello',
        after: 'hey',
        coalesceKey: 'set-value:a:s2',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      root1,
    );
    expect(stack.undo).toHaveLength(2);
  });

  it('coalesces same session coalesceKey when continuous', () => {
    const stack = createPathStack();
    const root0 = { a: '' };
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: '',
        after: 'h',
        coalesceKey: 'set-value:a:s1',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      root0,
    );
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 'h',
        after: 'he',
        coalesceKey: 'set-value:a:s1',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 'h' },
    );
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 'he',
        after: 'hello',
        coalesceKey: 'set-value:a:s1',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 'he' },
    );
    expect(stack.undo).toHaveLength(1);
    const top = stack.undo[0];
    expect(top.kind).toBe('path-replace');
    if (top.kind === 'path-replace') {
      expect(top.before).toBe('');
      expect(top.after).toBe('hello');
    }
  });

  it('does not coalesce bare keys across broken continuity', () => {
    const stack = createPathStack();
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 1,
        after: 2,
        coalesceKey: 'set-value:a:s1',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 1 },
    );
    // prevRoot does not match top.after → new entry
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 9,
        after: 10,
        coalesceKey: 'set-value:a:s1',
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 9 },
    );
    expect(stack.undo).toHaveLength(2);
  });

  it('trims to maxDepth', () => {
    const stack = createPathStack({ maxDepth: 3 });
    for (let i = 0; i < 5; i += 1) {
      recordEntry(
        stack,
        makePathReplace({
          path: ['n'],
          before: i,
          after: i + 1,
          origin: 'ui',
          commitKind: 'set-value',
        }),
        { n: i },
      );
    }
    expect(stack.undo).toHaveLength(3);
  });
});

describe('path-stack materialize', () => {
  it('undo/redo path-replace with continuity guard', () => {
    const stack = createPathStack();
    let root: unknown = { a: 1 };
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 1,
        after: 2,
        origin: 'ui',
        commitKind: 'set-value',
      }),
      root,
    );
    root = { a: 2 };

    const undone = applyUndo(stack, root);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.root).toEqual({ a: 1 });
      root = undone.root;
    }
    expect(canRedo(stack)).toBe(true);

    const redone = applyRedo(stack, root);
    expect(redone.ok).toBe(true);
    if (redone.ok) expect(redone.root).toEqual({ a: 2 });

    // Continuity fail: drift
    const stack2 = createPathStack();
    recordEntry(
      stack2,
      makePathReplace({
        path: ['a'],
        before: 1,
        after: 2,
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 1 },
    );
    const fail = planUndo(stack2, { a: 99 });
    expect(fail.ok).toBe(false);
    expect(stack2.undo).toHaveLength(1);
  });

  it('array mid-delete undo inserts (does not overwrite siblings)', () => {
    const stack = createPathStack();
    let root: unknown = { list: ['a', 'b', 'c'] };
    recordEntry(
      stack,
      makePathRemove({
        path: ['list', 1],
        value: 'b',
        origin: 'ui',
      }),
      root,
    );
    root = { list: ['a', 'c'] };

    const undone = applyUndo(stack, root);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.root).toEqual({ list: ['a', 'b', 'c'] });
      root = undone.root;
    }

    const redone = applyRedo(stack, root);
    expect(redone.ok).toBe(true);
    if (redone.ok) {
      expect(redone.root).toEqual({ list: ['a', 'c'] });
    }
  });

  it('object key delete restores order via keyIndex', () => {
    const stack = createPathStack();
    let root: unknown = { a: 1, b: 2, c: 3 };
    recordEntry(
      stack,
      makePathRemove({
        path: ['b'],
        value: 2,
        keyIndex: 1,
        origin: 'ui',
      }),
      root,
    );
    root = { a: 1, c: 3 };

    const undone = applyUndo(stack, root);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(Object.keys(undone.root as object)).toEqual(['a', 'b', 'c']);
      expect(undone.root).toEqual({ a: 1, b: 2, c: 3 });
    }
  });

  it('path-add undo deletes; redo inserts', () => {
    const stack = createPathStack();
    let root: unknown = { list: [1] };
    recordEntry(
      stack,
      makePathAdd({
        path: ['list', 1],
        value: 2,
        origin: 'ui',
        commitKind: 'add',
      }),
      root,
    );
    root = { list: [1, 2] };

    const undone = applyUndo(stack, root);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.root).toEqual({ list: [1] });
      root = undone.root;
    }

    const redone = applyRedo(stack, root);
    expect(redone.ok).toBe(true);
    if (redone.ok) expect(redone.root).toEqual({ list: [1, 2] });
  });

  it('path-rename undo/redo', () => {
    const stack = createPathStack();
    let root: unknown = { old: 1 };
    recordEntry(
      stack,
      makePathRename({
        parentPath: [],
        fromKey: 'old',
        toKey: 'new',
        origin: 'ui',
      }),
      root,
    );
    root = { new: 1 };

    const undone = applyUndo(stack, root);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.root).toEqual({ old: 1 });
      root = undone.root;
    }
    const redone = applyRedo(stack, root);
    expect(redone.ok).toBe(true);
    if (redone.ok) expect(redone.root).toEqual({ new: 1 });
  });

  it('path-reorder undo/redo', () => {
    const stack = createPathStack();
    let root: unknown = { list: ['a', 'b', 'c'] };
    recordEntry(
      stack,
      makePathReorder({
        arrayPath: ['list'],
        fromIndex: 0,
        toIndex: 2,
        origin: 'ui',
      }),
      root,
    );
    root = { list: ['b', 'c', 'a'] };

    const undone = applyUndo(stack, root);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.root).toEqual({ list: ['a', 'b', 'c'] });
      root = undone.root;
    }
    const redone = applyRedo(stack, root);
    expect(redone.ok).toBe(true);
    if (redone.ok) expect(redone.root).toEqual({ list: ['b', 'c', 'a'] });
  });

  it('fail closed leaves stacks intact', () => {
    const stack = createPathStack();
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 1,
        after: 2,
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 1 },
    );
    const r = materializeEntry(
      { a: 0 },
      stack.undo[0],
      'undo',
    );
    expect(r.ok).toBe(false);
    expect(stack.undo).toHaveLength(1);
    expect(stack.redo).toHaveLength(0);
  });

  it('clear wipes stacks', () => {
    const stack = createPathStack();
    recordEntry(
      stack,
      makePathReplace({
        path: ['a'],
        before: 1,
        after: 2,
        origin: 'ui',
        commitKind: 'set-value',
      }),
      { a: 1 },
    );
    applyUndo(stack, { a: 2 });
    clearPathStack(stack);
    expect(canUndo(stack)).toBe(false);
    expect(canRedo(stack)).toBe(false);
  });
});

describe('path-stack memory (leaf edits ≪ full doc)', () => {
  it('stacked approxBytes for leaf edits is far smaller than full doc × N', () => {
    // Large-ish fixture: many keys + one leaf we edit.
    const big: Record<string, unknown> = {};
    for (let i = 0; i < 200; i += 1) {
      big[`k${i}`] = {
        text: `value-${i}-${'x'.repeat(40)}`,
        n: i,
        nested: { a: 1, b: [1, 2, 3, 4, 5] },
      };
    }
    big.target = 'start';

    const fullDocBytes = approxJsonBytes(big);
    expect(fullDocBytes).toBeGreaterThan(10_000);

    const stack = createPathStack({ maxDepth: 100 });
    let prev = 'start';
    const N = 20;
    for (let i = 0; i < N; i += 1) {
      const next = `edit-${i}`;
      recordEntry(
        stack,
        makePathReplace({
          path: ['target'],
          before: prev,
          after: next,
          coalesceKey: `set-value:target:s${i}`, // separate sessions
          origin: 'ui',
          commitKind: 'set-value',
        }),
        { ...big, target: prev },
      );
      prev = next;
    }

    const snap = readHistory(stack);
    expect(snap.undoDepth).toBe(N);
    // Path-scoped: roughly leaf strings only, not N × full doc.
    expect(snap.approxBytes).toBeLessThan(fullDocBytes * 0.1);
    expect(snap.approxBytes).toBeLessThan(fullDocBytes);
    // Sanity: still recorded something.
    expect(snap.approxBytes).toBeGreaterThan(0);

    // IR product law: each stack entry holds leaf payloads only — never the
    // full document object/string as before/after (PRD §2, §10.1/§10.8).
    for (const entry of stack.undo) {
      expect(entry.kind).toBe('path-replace');
      if (entry.kind === 'path-replace') {
        expect(typeof entry.before).toBe('string');
        expect(typeof entry.after).toBe('string');
        expect(entry.before).not.toEqual(big);
        expect(entry.after).not.toEqual(big);
        // Guard against accidental full-doc stringify storage
        expect(approxJsonBytes(entry.before) + approxJsonBytes(entry.after)).toBeLessThan(
          fullDocBytes * 0.05,
        );
      }
    }
  });

  it('root path-replace may be O(doc) — labeled exception (PRD §10.9)', () => {
    const rootBefore = { a: 1, b: { nested: true }, c: [1, 2, 3] };
    const rootAfter = {};
    const stack = createPathStack();
    recordEntry(
      stack,
      makePathReplace({
        path: [],
        before: rootBefore,
        after: rootAfter,
        origin: 'ui',
        commitKind: 'clear',
      }),
      rootBefore,
    );
    const top = stack.undo[0];
    expect(top.kind).toBe('path-replace');
    if (top.kind === 'path-replace') {
      // Exception: path [] stores full root subtree (documented O(doc)).
      expect(top.path).toEqual([]);
      expect(top.before).toEqual(rootBefore);
      expect(top.after).toEqual({});
    }
  });
});
