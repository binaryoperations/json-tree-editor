import { describe, expect, it } from 'vitest';

import {
  ancestorPathKeys,
  collectSearchMatches,
  primitiveDisplayString,
  splitHighlightSegments,
  textMatches,
} from './search';

describe('textMatches', () => {
  it('matches case-insensitively', () => {
    expect(textMatches('Hello World', 'hello')).toBe(true);
    expect(textMatches('Hello World', 'WORLD')).toBe(true);
  });

  it('rejects empty / whitespace query', () => {
    expect(textMatches('hello', '')).toBe(false);
    expect(textMatches('hello', '   ')).toBe(false);
  });
});

describe('primitiveDisplayString', () => {
  it('stringifies primitives', () => {
    expect(primitiveDisplayString('hi')).toBe('hi');
    expect(primitiveDisplayString(42)).toBe('42');
    expect(primitiveDisplayString(true)).toBe('true');
    expect(primitiveDisplayString(null)).toBe('null');
  });

  it('returns null for containers', () => {
    expect(primitiveDisplayString({})).toBeNull();
    expect(primitiveDisplayString([])).toBeNull();
  });
});

describe('splitHighlightSegments', () => {
  it('returns whole text when query empty', () => {
    expect(splitHighlightSegments('abc', '')).toEqual([
      { text: 'abc', match: false },
    ]);
  });

  it('splits multiple case-insensitive hits', () => {
    expect(splitHighlightSegments('abXab', 'AB')).toEqual([
      { text: 'ab', match: true },
      { text: 'X', match: false },
      { text: 'ab', match: true },
    ]);
  });

  it('preserves original casing in segments', () => {
    expect(splitHighlightSegments('FooBar', 'oo')).toEqual([
      { text: 'F', match: false },
      { text: 'oo', match: true },
      { text: 'Bar', match: false },
    ]);
  });
});

describe('ancestorPathKeys', () => {
  it('includes root and every prefix', () => {
    expect(ancestorPathKeys(['a', 'b'])).toEqual(['', 'a', 'a\0b']);
  });

  it('root-only for empty path', () => {
    expect(ancestorPathKeys([])).toEqual(['']);
  });
});

describe('collectSearchMatches', () => {
  const doc = {
    name: 'Ada',
    age: 36,
    nested: { name: 'Lovelace', tags: ['math', 'poetry'] },
    active: true,
    note: null as null,
  };

  it('matches object keys', () => {
    const m = collectSearchMatches(doc, 'name');
    expect(m).toEqual(
      expect.arrayContaining([
        { path: ['name'], field: 'key' },
        { path: ['nested', 'name'], field: 'key' },
      ]),
    );
  });

  it('matches string and number values', () => {
    expect(collectSearchMatches(doc, 'Ada')).toEqual([
      { path: ['name'], field: 'value' },
    ]);
    expect(collectSearchMatches(doc, '36')).toEqual([
      { path: ['age'], field: 'value' },
    ]);
  });

  it('matches boolean and null display strings', () => {
    expect(collectSearchMatches(doc, 'true')).toEqual([
      { path: ['active'], field: 'value' },
    ]);
    expect(collectSearchMatches(doc, 'null')).toEqual([
      { path: ['note'], field: 'value' },
    ]);
  });

  it('does not match array index labels as keys', () => {
    const m = collectSearchMatches(doc, '0');
    expect(m.every((x) => x.field !== 'key' || typeof x.path[x.path.length - 1] !== 'number')).toBe(
      true,
    );
    // "0" should not invent a key match on index 0
    expect(m.filter((x) => x.field === 'key')).toEqual([]);
  });

  it('still matches array element values', () => {
    expect(collectSearchMatches(doc, 'math')).toEqual([
      { path: ['nested', 'tags', 0], field: 'value' },
    ]);
  });

  it('returns empty for blank query', () => {
    expect(collectSearchMatches(doc, '  ')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(collectSearchMatches(doc, 'ADA')).toEqual([
      { path: ['name'], field: 'value' },
    ]);
  });

  it('orders matches DFS (key before value on same node when both hit)', () => {
    const root = { foo: 'foo' };
    expect(collectSearchMatches(root, 'foo')).toEqual([
      { path: ['foo'], field: 'key' },
      { path: ['foo'], field: 'value' },
    ]);
  });
});
