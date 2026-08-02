import { describe, expect, it } from 'vitest';

import {
  addItemAtPath,
  addPropertyAtPath,
  addShapedItemAtPath,
  addShapedPropertyAtPath,
  cloneJsonShape,
  collectContainerPathKeys,
  collectVisiblePaths,
  convertJsonType,
  defaultExpandedPaths,
  deleteAtPath,
  getAtPath,
  jsonTypeOf,
  parseCompleteNumber,
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
    expect(cloneJsonShape([1, 'a', false])).toEqual([0, '', false]);
    expect(
      cloneJsonShape({
        name: 'Ada',
        score: 10,
        ok: true,
        note: null,
        tags: ['x'],
        meta: { id: 7 },
      }),
    ).toEqual({
      name: '',
      score: 0,
      ok: false,
      note: null,
      tags: [''],
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

  it('clones the last object property value shape', () => {
    expect(
      siblingTemplateShape({
        first: { a: 1 },
        last: { name: 'z', tags: [1] },
      }),
    ).toEqual({ name: '', tags: [0] });
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

describe('jsonTypeOf', () => {
  it('classifies JSON values', () => {
    expect(jsonTypeOf(null)).toBe('null');
    expect(jsonTypeOf('x')).toBe('string');
    expect(jsonTypeOf(1)).toBe('number');
    expect(jsonTypeOf(true)).toBe('boolean');
    expect(jsonTypeOf([])).toBe('array');
    expect(jsonTypeOf({})).toBe('object');
  });
});

describe('convertJsonType', () => {
  it('converts to string', () => {
    expect(convertJsonType('keep', 'string')).toBe('keep');
    expect(convertJsonType(null, 'string')).toBe('');
    expect(convertJsonType(true, 'string')).toBe('true');
    expect(convertJsonType({ a: 1 }, 'string')).toBe('{"a":1}');
  });

  it('converts to number', () => {
    expect(convertJsonType(3, 'number')).toBe(3);
    expect(convertJsonType(true, 'number')).toBe(1);
    expect(convertJsonType(false, 'number')).toBe(0);
    expect(convertJsonType('9.5', 'number')).toBe(9.5);
    expect(convertJsonType('nope', 'number')).toBe(0);
    expect(convertJsonType(null, 'number')).toBe(0);
  });

  it('converts to boolean', () => {
    expect(convertJsonType(true, 'boolean')).toBe(true);
    expect(convertJsonType(0, 'boolean')).toBe(false);
    expect(convertJsonType(2, 'boolean')).toBe(true);
    expect(convertJsonType('', 'boolean')).toBe(false);
    expect(convertJsonType('false', 'boolean')).toBe(false);
    expect(convertJsonType('x', 'boolean')).toBe(true);
    expect(convertJsonType(null, 'boolean')).toBe(false);
  });

  it('converts to null / object / array defaults', () => {
    expect(convertJsonType(1, 'null')).toBe(null);
    expect(convertJsonType(1, 'object')).toEqual({});
    expect(convertJsonType({ a: 1 }, 'object')).toEqual({ a: 1 });
    expect(convertJsonType(1, 'array')).toEqual([]);
    expect(convertJsonType([1], 'array')).toEqual([1]);
  });
});
