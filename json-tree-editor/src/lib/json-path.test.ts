import { describe, expect, it } from 'vitest';

import {
  addItemAtPath,
  addPropertyAtPath,
  addShapedItemAtPath,
  addShapedPropertyAtPath,
  cloneJsonShape,
  collectChildContainerPathKeys,
  collectChildContainerPaths,
  collectContainerPathKeys,
  collectDescendantContainerPaths,
  collectSubtreeContainerPathKeys,
  collectSubtreeContainerPaths,
  collectVisiblePaths,
  convertJsonType,
  defaultExpandedPaths,
  expandedPathsUpToDepth,
  deleteAtPath,
  deepCloneJson,
  duplicateAtPath,
  duplicateKeyAtPath,
  getAtPath,
  arrayDropTargetIndex,
  moveArrayItemAtPath,
  moveArrayItemByDelta,
  jsonTypeOf,
  parseCompleteNumber,
  parseNullEditorDraft,
  pathDomId,
  pathKey,
  renameKeyAtPath,
  ROOT_PATH_KEY,
  setAtPath,
  siblingTemplateShape,
  uniqueObjectKey,
} from './json-path';

describe('pathKey / pathDomId / defaultExpandedPaths', () => {
  it('uses empty string as root path key', () => {
    expect(pathKey([])).toBe(ROOT_PATH_KEY);
    expect(ROOT_PATH_KEY).toBe('');
  });

  it('joins segments with a null separator', () => {
    expect(pathKey(['a', 0, 'b'])).toBe('a\x000\x00b');
  });

  it('serializes paths for DOM ids', () => {
    expect(pathDomId([])).toBe('[]');
    expect(pathDomId(['items', 1])).toBe('["items",1]');
  });

  it('defaults expand set to root only', () => {
    expect([...defaultExpandedPaths()]).toEqual([ROOT_PATH_KEY]);
  });
});

describe('expandedPathsUpToDepth', () => {
  const doc = {
    a: { b: { c: 1 } },
    list: [{ x: true }],
  };

  it('depth 0 is root only', () => {
    expect([...expandedPathsUpToDepth(doc, 0)]).toEqual([ROOT_PATH_KEY]);
  });

  it('depth 1 includes root and direct child containers', () => {
    const keys = expandedPathsUpToDepth(doc, 1);
    expect(keys.has(ROOT_PATH_KEY)).toBe(true);
    expect(keys.has(pathKey(['a']))).toBe(true);
    expect(keys.has(pathKey(['list']))).toBe(true);
    expect(keys.has(pathKey(['a', 'b']))).toBe(false);
    expect(keys.has(pathKey(['list', 0]))).toBe(false);
  });

  it('depth 2 opens one level deeper', () => {
    const keys = expandedPathsUpToDepth(doc, 2);
    expect(keys.has(pathKey(['a', 'b']))).toBe(true);
    expect(keys.has(pathKey(['list', 0]))).toBe(true);
    expect(keys.has(pathKey(['a', 'b', 'c']))).toBe(false);
  });
});

describe('collectContainerPathKeys', () => {
  it('walks objects and arrays in DFS order and skips primitives', () => {
    const doc = {
      a: 1,
      nest: { b: true },
      list: [{ x: 1 }, 2],
    };
    const keys = collectContainerPathKeys(doc);
    expect(keys).toEqual([
      ROOT_PATH_KEY,
      pathKey(['nest']),
      pathKey(['list']),
      pathKey(['list', 0]),
    ]);
  });

  it('returns only root for empty containers', () => {
    expect(collectContainerPathKeys({})).toEqual([ROOT_PATH_KEY]);
    expect(collectContainerPathKeys([])).toEqual([ROOT_PATH_KEY]);
  });
});

describe('collectChildContainerPathKeys / collectSubtreeContainerPathKeys', () => {
  const doc = {
    a: 1,
    nest: { b: true, deep: { c: 2 } },
    list: [{ x: 1 }, 2, [3]],
  };

  it('lists only direct child containers under a path', () => {
    expect(collectChildContainerPathKeys(doc, [])).toEqual([
      pathKey(['nest']),
      pathKey(['list']),
    ]);
    expect(collectChildContainerPathKeys(doc, ['nest'])).toEqual([
      pathKey(['nest', 'deep']),
    ]);
    expect(collectChildContainerPathKeys(doc, ['list'])).toEqual([
      pathKey(['list', 0]),
      pathKey(['list', 2]),
    ]);
    expect(collectChildContainerPathKeys(doc, ['a'])).toEqual([]);
    expect(collectChildContainerPathKeys(doc, ['missing'])).toEqual([]);
  });

  it('lists the full container subtree including the path node', () => {
    expect(collectSubtreeContainerPathKeys(doc, ['nest'])).toEqual([
      pathKey(['nest']),
      pathKey(['nest', 'deep']),
    ]);
    expect(collectSubtreeContainerPathKeys(doc, ['list'])).toEqual([
      pathKey(['list']),
      pathKey(['list', 0]),
      pathKey(['list', 2]),
    ]);
    expect(collectSubtreeContainerPathKeys(doc, ['a'])).toEqual([]);
    // Root subtree matches full-document collect
    expect(collectSubtreeContainerPathKeys(doc, [])).toEqual(
      collectContainerPathKeys(doc),
    );
  });

  it('lists child / subtree / descendant as JsonPath arrays', () => {
    expect(collectChildContainerPaths(doc, [])).toEqual([['nest'], ['list']]);
    expect(collectSubtreeContainerPaths(doc, ['nest'])).toEqual([
      ['nest'],
      ['nest', 'deep'],
    ]);
    // Descendants exclude self
    expect(collectDescendantContainerPaths(doc, ['nest'])).toEqual([
      ['nest', 'deep'],
    ]);
    expect(collectDescendantContainerPaths(doc, [])).toEqual([
      ['nest'],
      ['nest', 'deep'],
      ['list'],
      ['list', 0],
      ['list', 2],
    ]);
    expect(collectDescendantContainerPaths(doc, ['a'])).toEqual([]);
  });
});

describe('collectVisiblePaths', () => {
  const doc = {
    a: { b: 1 },
    list: [0, { c: 2 }],
  };

  it('always includes root; children only when expanded', () => {
    const collapsed = collectVisiblePaths(doc, new Set());
    expect(collapsed).toEqual([[]]);

    const rootOnly = collectVisiblePaths(doc, new Set([ROOT_PATH_KEY]));
    expect(rootOnly).toEqual([[], ['a'], ['list']]);

    const deep = collectVisiblePaths(
      doc,
      new Set([ROOT_PATH_KEY, pathKey(['a']), pathKey(['list'])]),
    );
    expect(deep).toEqual([[], ['a'], ['a', 'b'], ['list'], ['list', 0], ['list', 1]]);
  });
});

describe('getAtPath / setAtPath / deleteAtPath', () => {
  const sample = {
    user: { name: 'Ada', tags: ['a', 'b'] },
    n: 1,
  };

  it('reads nested values and returns undefined for invalid paths', () => {
    expect(getAtPath(sample, [])).toEqual(sample);
    expect(getAtPath(sample, ['user', 'name'])).toBe('Ada');
    expect(getAtPath(sample, ['user', 'tags', 1])).toBe('b');
    expect(getAtPath(sample, ['missing'])).toBeUndefined();
    expect(getAtPath(sample, ['n', 'x'])).toBeUndefined();
  });

  it('setAtPath replaces root when path is empty', () => {
    expect(setAtPath(sample, [], { z: 1 })).toEqual({ z: 1 });
  });

  it('setAtPath updates immutably through objects and arrays', () => {
    const next = setAtPath(sample, ['user', 'tags', 0], 'A') as typeof sample;
    expect(next.user.tags).toEqual(['A', 'b']);
    expect(sample.user.tags).toEqual(['a', 'b']);
    expect(next.user).not.toBe(sample.user);
  });

  it('deleteAtPath is a no-op for the empty path (root cannot be deleted)', () => {
    expect(deleteAtPath(sample, [])).toBe(sample);
  });

  it('deleteAtPath removes object keys and array indices immutably', () => {
    const withoutName = deleteAtPath(sample, ['user', 'name']) as typeof sample;
    expect(withoutName.user).toEqual({ tags: ['a', 'b'] });
    expect(sample.user.name).toBe('Ada');

    const withoutFirstTag = deleteAtPath(sample, [
      'user',
      'tags',
      0,
    ]) as typeof sample;
    expect(withoutFirstTag.user.tags).toEqual(['b']);
  });
});

describe('renameKeyAtPath', () => {
  const root = { a: 1, b: 2, nest: { x: 9, y: 8 } };

  it('renames keys and preserves insertion order', () => {
    const next = renameKeyAtPath(root, [], 'a', 'alpha') as Record<
      string,
      unknown
    >;
    expect(Object.keys(next)).toEqual(['alpha', 'b', 'nest']);
    expect(next.alpha).toBe(1);
  });

  it('renames nested keys', () => {
    const next = renameKeyAtPath(root, ['nest'], 'x', 'xx') as typeof root;
    expect(next.nest).toEqual({ xx: 9, y: 8 });
  });

  it('renames a key inside an object nested in an array (UI path shape)', () => {
    const doc = {
      items: [
        { sku: 'A-100', qty: 3 },
        { sku: 'B-200', qty: 1 },
      ],
    };
    // Tree path for the first item's "sku" key is [items, 0, sku];
    // rename uses parentPath [items, 0] + oldKey "sku".
    const next = renameKeyAtPath(doc, ['items', 0], 'sku', 'code') as typeof doc;
    expect(next.items[0]).toEqual({ code: 'A-100', qty: 3 });
    expect(next.items[1]).toEqual({ sku: 'B-200', qty: 1 });
    // Original document must stay immutable.
    expect(doc.items[0]).toEqual({ sku: 'A-100', qty: 3 });
  });

  it('renames deep object keys without dropping siblings', () => {
    const doc = {
      meta: { createdAt: 't', author: { id: 7, email: 'a@b.c' } },
    };
    const next = renameKeyAtPath(
      doc,
      ['meta', 'author'],
      'email',
      'mail',
    ) as typeof doc;
    expect(next.meta.author).toEqual({ id: 7, mail: 'a@b.c' });
    expect(next.meta.createdAt).toBe('t');
  });

  it('no-ops on missing key, collision, empty new key, or same key', () => {
    expect(renameKeyAtPath(root, [], 'missing', 'z')).toBe(root);
    expect(renameKeyAtPath(root, [], 'a', 'b')).toBe(root);
    expect(renameKeyAtPath(root, [], 'a', '')).toBe(root);
    expect(renameKeyAtPath(root, [], 'a', 'a')).toBe(root);
  });
});

describe('addPropertyAtPath / addItemAtPath', () => {
  it('adds object properties and is a no-op on collision or non-object', () => {
    const root = { a: 1 };
    expect(addPropertyAtPath(root, [], 'b', true)).toEqual({ a: 1, b: true });
    expect(addPropertyAtPath(root, [], 'a', 9)).toBe(root);
    expect(addPropertyAtPath([1], [], 'x', 1)).toEqual([1]);
  });

  it('appends array items', () => {
    const root = { list: [1] };
    expect(addItemAtPath(root, ['list'], 2)).toEqual({ list: [1, 2] });
    expect(addItemAtPath(root, [], 2)).toBe(root);
  });
});

describe('cloneJsonShape', () => {
  it('clears leaves to type defaults and preserves structure', () => {
    expect(cloneJsonShape(null)).toBe(null);
    expect(cloneJsonShape('hi')).toBe('');
    expect(cloneJsonShape(42)).toBe(0);
    expect(cloneJsonShape(true)).toBe(false);
    // Arrays always seed exactly one item (shape of the last element).
    expect(cloneJsonShape([1, 'a', false])).toEqual([false]);
    expect(cloneJsonShape([0, 1])).toEqual([0]);
    expect(cloneJsonShape([])).toEqual([null]);
    expect(
      cloneJsonShape({
        name: 'Ada',
        score: 10,
        ok: true,
        note: null,
        tags: ['x', 'y'],
        meta: { id: 7 },
      }),
    ).toEqual({
      name: '',
      score: 0,
      ok: false,
      note: null,
      tags: [''], // one slot from last tag "y"
      meta: { id: 0 },
    });
  });
});

describe('siblingTemplateShape', () => {
  it('returns null for empty containers and non-containers', () => {
    expect(siblingTemplateShape([])).toBe(null);
    expect(siblingTemplateShape({})).toBe(null);
    expect(siblingTemplateShape(null)).toBe(null);
    expect(siblingTemplateShape(1)).toBe(null);
  });

  it('clones the last array element shape', () => {
    expect(siblingTemplateShape([{ a: 1 }, { b: 'x', n: 2 }])).toEqual({
      b: '',
      n: 0,
    });
    expect(siblingTemplateShape(['only'])).toBe('');
  });

  it('clones the last object property value shape (arrays → 1 item)', () => {
    expect(
      siblingTemplateShape({
        first: { a: 1 },
        last: { name: 'z', tags: [1, 2] },
      }),
    ).toEqual({ name: '', tags: [0] });
  });

  it('when adding a key after an array property, seeds a 1-item array', () => {
    // Repro: root { key: [0, 1] } +key should not copy length 2.
    expect(siblingTemplateShape({ key: [0, 1] })).toEqual([0]);
    expect(addShapedPropertyAtPath({ key: [0, 1] }, [], 'key1')).toEqual({
      key: [0, 1],
      key1: [0],
    });
  });
});

describe('addShapedItemAtPath / addShapedPropertyAtPath', () => {
  it('appends a shaped array item; empty array → null', () => {
    const withItems = { list: [{ sku: 'A', qty: 3 }] };
    expect(addShapedItemAtPath(withItems, ['list'])).toEqual({
      list: [
        { sku: 'A', qty: 3 },
        { sku: '', qty: 0 },
      ],
    });

    expect(addShapedItemAtPath({ list: [] }, ['list'])).toEqual({
      list: [null],
    });
  });

  it('adds a shaped object property; empty object → null', () => {
    const root = { meta: { a: { x: 1 } } };
    expect(addShapedPropertyAtPath(root, ['meta'], 'b')).toEqual({
      meta: { a: { x: 1 }, b: { x: 0 } },
    });

    expect(addShapedPropertyAtPath({}, [], 'first')).toEqual({ first: null });
  });

  it('no-ops shaped add when parent type mismatches', () => {
    const root = { list: [1], obj: { a: 1 } };
    expect(addShapedItemAtPath(root, ['obj'])).toBe(root);
    expect(addShapedPropertyAtPath(root, ['list'], 'x')).toBe(root);
  });
});


describe('duplicateAtPath', () => {
  it('no-ops on the document root', () => {
    const root = { a: 1 };
    expect(duplicateAtPath(root, [])).toBe(root);
    expect(duplicateKeyAtPath(root, [])).toBe(null);
  });

  it('deep-clones an entire object property as the next sibling key', () => {
    const root = {
      meta: { createdAt: 't', author: { id: 7 } },
      name: 'Ada',
    };
    const next = duplicateAtPath(root, ['meta']) as typeof root & {
      meta1: unknown;
    };
    expect(Object.keys(next)).toEqual(['meta', 'meta1', 'name']);
    expect(next.meta1).toEqual({ createdAt: 't', author: { id: 7 } });
    expect(next.meta1).not.toBe(next.meta);
    expect(
      (next.meta1 as { author: unknown }).author,
    ).not.toBe(next.meta.author);
    expect(duplicateKeyAtPath(root, ['meta'])).toBe('meta1');
  });

  it('inserts a deep-cloned array item immediately after the source index', () => {
    const root = { list: [{ sku: 'A' }, { sku: 'B' }] };
    const next = duplicateAtPath(root, ['list', 0]) as typeof root;
    expect(next.list).toEqual([{ sku: 'A' }, { sku: 'A' }, { sku: 'B' }]);
    expect(next.list[1]).not.toBe(next.list[0]);
  });

  it('no-ops when the node is a primitive', () => {
    const root = { name: 'Ada', n: 1, list: [true, null] };
    expect(duplicateAtPath(root, ['name'])).toBe(root);
    expect(duplicateAtPath(root, ['n'])).toBe(root);
    expect(duplicateAtPath(root, ['list', 0])).toBe(root);
    expect(duplicateAtPath(root, ['list', 1])).toBe(root);
  });

  it('deepCloneJson copies nested structures', () => {
    const v = { a: [1, { b: 2 }] };
    const c = deepCloneJson(v) as typeof v;
    expect(c).toEqual(v);
    expect(c).not.toBe(v);
    expect(c.a).not.toBe(v.a);
  });
});

describe('moveArrayItemAtPath / moveArrayItemByDelta', () => {
  it('moves an item to an absolute index within the same array', () => {
    const root = { list: ['a', 'b', 'c', 'd'] };
    const next = moveArrayItemAtPath(root, ['list', 1], 3) as typeof root;
    expect(next.list).toEqual(['a', 'c', 'd', 'b']);
    expect(next).not.toBe(root);
    expect(next.list).not.toBe(root.list);
  });

  it('moves nested array items and clamps out-of-range targets', () => {
    const root = { outer: [[1, 2, 3]] };
    const up = moveArrayItemAtPath(root, ['outer', 0, 2], 0) as typeof root;
    expect(up.outer[0]).toEqual([3, 1, 2]);

    const clamped = moveArrayItemAtPath(root, ['outer', 0, 0], 99) as typeof root;
    expect(clamped.outer[0]).toEqual([2, 3, 1]);
  });

  it('no-ops when already at target, single-item, invalid path, or non-array parent', () => {
    const root = { list: ['a', 'b'], obj: { x: 1 } };
    expect(moveArrayItemAtPath(root, ['list', 0], 0)).toBe(root);
    expect(moveArrayItemAtPath(root, ['list', 0], -5)).toBe(root); // clamps to 0
    expect(moveArrayItemAtPath({ one: [1] }, ['one', 0], 1)).toEqual({
      one: [1],
    });
    // Same reference when length ≤ 1
    const one = { one: [1] };
    expect(moveArrayItemAtPath(one, ['one', 0], 0)).toBe(one);

    expect(moveArrayItemAtPath(root, [], 0)).toBe(root);
    expect(moveArrayItemAtPath(root, ['obj', 'x'], 0)).toBe(root);
    expect(moveArrayItemAtPath(root, ['list', 9], 0)).toBe(root);
    expect(moveArrayItemAtPath(root, ['missing', 0], 1)).toBe(root);
  });

  it('moveArrayItemByDelta shifts by relative steps', () => {
    const root = { list: ['a', 'b', 'c'] };
    expect(moveArrayItemByDelta(root, ['list', 2], -1)).toEqual({
      list: ['a', 'c', 'b'],
    });
    expect(moveArrayItemByDelta(root, ['list', 0], 1)).toEqual({
      list: ['b', 'a', 'c'],
    });
    // Out of bounds (clamped) is a no-op when already at edge
    expect(moveArrayItemByDelta(root, ['list', 0], -1)).toBe(root);
    expect(moveArrayItemByDelta(root, ['list', 2], 1)).toBe(root);
    expect(moveArrayItemByDelta(root, ['list', 1], 0)).toBe(root);
  });

  it('works when the document root is an array', () => {
    const root = ['x', 'y', 'z'];
    expect(moveArrayItemByDelta(root, [1], -1)).toEqual(['y', 'x', 'z']);
    expect(moveArrayItemAtPath(root, [0], 2)).toEqual(['y', 'z', 'x']);
  });

  it('arrayDropTargetIndex maps hover edge to final insert index', () => {
    // Move first item after last row
    expect(arrayDropTargetIndex(0, 3, 'after')).toBe(3);
    // Move first item before last row
    expect(arrayDropTargetIndex(0, 3, 'before')).toBe(2);
    // Move last item before first
    expect(arrayDropTargetIndex(3, 0, 'before')).toBe(0);
    // Move last item after first
    expect(arrayDropTargetIndex(3, 0, 'after')).toBe(1);
    // No-op: drop on self
    expect(arrayDropTargetIndex(1, 1, 'before')).toBe(1);
    expect(arrayDropTargetIndex(1, 1, 'after')).toBe(1);
    // Adjacent swap: item 2 onto top half of item 1
    expect(arrayDropTargetIndex(2, 1, 'before')).toBe(1);
  });
});

describe('uniqueObjectKey', () => {
  it('returns base when free, otherwise suffixes', () => {
    expect(uniqueObjectKey({})).toBe('key');
    expect(uniqueObjectKey({ key: 1 })).toBe('key1');
    expect(uniqueObjectKey({ key: 1, key1: 2, key2: 3 })).toBe('key3');
    expect(uniqueObjectKey({ name: 1 }, 'name')).toBe('name1');
  });
});

describe('parseCompleteNumber', () => {
  it('parses complete finite numbers', () => {
    expect(parseCompleteNumber('0')).toBe(0);
    expect(parseCompleteNumber('-12')).toBe(-12);
    expect(parseCompleteNumber('3.14')).toBe(3.14);
    expect(parseCompleteNumber('1e3')).toBe(1000);
    expect(parseCompleteNumber('1.5e-2')).toBe(0.015);
    expect(parseCompleteNumber('  42  ')).toBe(42);
  });

  it('rejects empty, incomplete, and invalid drafts', () => {
    for (const bad of [
      '',
      '   ',
      '-',
      '1.',
      '1e',
      '1e-',
      '+1',
      '0x10',
      '01',
      '1_000',
      'abc',
    ]) {
      expect(parseCompleteNumber(bad), bad).toBeUndefined();
    }
  });
});

describe('parseNullEditorDraft', () => {
  it('keeps null on empty / whitespace', () => {
    expect(parseNullEditorDraft('')).toBe(null);
    expect(parseNullEditorDraft('   ')).toBe(null);
    expect(parseNullEditorDraft('\n\t')).toBe(null);
  });

  it('uses JSON.parse when the draft is valid JSON', () => {
    expect(parseNullEditorDraft('null')).toBe(null);
    expect(parseNullEditorDraft('true')).toBe(true);
    expect(parseNullEditorDraft('false')).toBe(false);
    expect(parseNullEditorDraft('42')).toBe(42);
    expect(parseNullEditorDraft('-3.5')).toBe(-3.5);
    expect(parseNullEditorDraft('"hello"')).toBe('hello');
    expect(parseNullEditorDraft('[1, 2]')).toEqual([1, 2]);
    expect(parseNullEditorDraft('{"a":1}')).toEqual({ a: 1 });
  });

  it('falls back to number or string when JSON.parse fails', () => {
    expect(parseNullEditorDraft('hello')).toBe('hello');
    expect(parseNullEditorDraft('1.')).toBe('1.');
    expect(parseNullEditorDraft('01')).toBe('01');
  });
});

describe('jsonTypeOf', () => {
  it('classifies JSON values', () => {
    expect(jsonTypeOf(null)).toBe('null');
    expect(jsonTypeOf('x')).toBe('string');
    expect(jsonTypeOf(1)).toBe('number');
    expect(jsonTypeOf(true)).toBe('boolean');
    expect(jsonTypeOf([])).toBe('array');
    expect(jsonTypeOf({})).toBe('object');
  });

  it('treats Date as a string leaf (ISO), not an object', () => {
    const d = new Date('2020-01-15T12:00:00.000Z');
    expect(jsonTypeOf(d)).toBe('string');
    expect(jsonTypeOf(d)).not.toBe('object');
  });
});

describe('convertJsonType', () => {
  it('converts to string (always empty)', () => {
    expect(convertJsonType('keep', 'string')).toBe('');
    expect(convertJsonType(null, 'string')).toBe('');
    expect(convertJsonType(true, 'string')).toBe('');
    expect(convertJsonType(42, 'string')).toBe('');
    expect(convertJsonType({ a: 1 }, 'string')).toBe('');
  });

  it('converts to number', () => {
    expect(convertJsonType(3, 'number')).toBe(3);
    expect(convertJsonType(true, 'number')).toBe(1);
    expect(convertJsonType(false, 'number')).toBe(0);
    expect(convertJsonType('9.5', 'number')).toBe(9.5);
    expect(convertJsonType('nope', 'number')).toBe(0);
    expect(convertJsonType(null, 'number')).toBe(0);
  });

  it('converts to boolean (always false)', () => {
    expect(convertJsonType(true, 'boolean')).toBe(false);
    expect(convertJsonType(0, 'boolean')).toBe(false);
    expect(convertJsonType(2, 'boolean')).toBe(false);
    expect(convertJsonType('x', 'boolean')).toBe(false);
    expect(convertJsonType(null, 'boolean')).toBe(false);
    expect(convertJsonType({ a: 1 }, 'boolean')).toBe(false);
  });

  it('converts to null / object / array defaults', () => {
    expect(convertJsonType(1, 'null')).toBe(null);
    // Fresh containers seed one entry and keep the previous primitive value.
    expect(convertJsonType(1, 'object')).toEqual({ key: 1 });
    expect(convertJsonType('hi', 'object')).toEqual({ key: 'hi' });
    expect(convertJsonType(true, 'object')).toEqual({ key: true });
    expect(convertJsonType(null, 'object')).toEqual({ key: null });
    expect(convertJsonType([1, 2], 'object')).toEqual({ key: [1, 2] });
    expect(convertJsonType({ a: 1 }, 'object')).toEqual({ a: 1 });
    expect(convertJsonType(1, 'array')).toEqual([1]);
    expect(convertJsonType('hi', 'array')).toEqual(['hi']);
    expect(convertJsonType(false, 'array')).toEqual([false]);
    expect(convertJsonType(null, 'array')).toEqual([null]);
    expect(convertJsonType({ a: 1 }, 'array')).toEqual([{ a: 1 }]);
    expect(convertJsonType([1], 'array')).toEqual([1]);
  });
});
