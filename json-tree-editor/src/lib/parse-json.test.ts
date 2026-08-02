import { describe, expect, it } from 'vitest';

import {
  EMPTY_ROOT,
  isJsonRootValue,
  parseJsonSource,
} from './parse-json';

describe('isJsonRootValue', () => {
  it('accepts plain objects and arrays', () => {
    expect(isJsonRootValue({})).toBe(true);
    expect(isJsonRootValue({ a: 1 })).toBe(true);
    expect(isJsonRootValue([])).toBe(true);
    expect(isJsonRootValue([1, 2])).toBe(true);
  });

  it('rejects primitives and null', () => {
    expect(isJsonRootValue(null)).toBe(false);
    expect(isJsonRootValue(undefined)).toBe(false);
    expect(isJsonRootValue(0)).toBe(false);
    expect(isJsonRootValue(42)).toBe(false);
    expect(isJsonRootValue('')).toBe(false);
    expect(isJsonRootValue('hi')).toBe(false);
    expect(isJsonRootValue(true)).toBe(false);
    expect(isJsonRootValue(false)).toBe(false);
  });
});

describe('parseJsonSource', () => {
  it('accepts object and array roots', () => {
    const obj = parseJsonSource('{"a":1}');
    expect(obj).toMatchObject({
      ok: true,
      value: { a: 1 },
      pretty: '{\n  "a": 1\n}',
    });

    const arr = parseJsonSource('[1, 2]');
    expect(arr).toMatchObject({
      ok: true,
      value: [1, 2],
    });
    if (arr.ok) {
      expect(arr.pretty).toContain('1');
    }
  });

  it('accepts empty object and empty array roots', () => {
    expect(parseJsonSource('{}')).toMatchObject({ ok: true, value: {} });
    expect(parseJsonSource('[]')).toMatchObject({ ok: true, value: [] });
  });

  it('treats empty / whitespace-only source as a valid empty object (no error)', () => {
    for (const source of ['', '   ', '\n\t']) {
      const result = parseJsonSource(source);
      expect(result).toEqual({
        ok: true,
        pretty: JSON.stringify(EMPTY_ROOT, null, 2),
        value: EMPTY_ROOT,
      });
    }
  });

  it.each([
    ['null', 'null'],
    ['true', 'boolean'],
    ['false', 'boolean'],
    ['0', 'number'],
    ['42', 'number'],
    ['-3.5', 'number'],
    ['"hello"', 'string'],
    ['""', 'string'],
  ] as const)(
    'rejects primitive root %s with empty-object fallback',
    (source, kind) => {
      const result = parseJsonSource(source);
      expect(result).toEqual({
        ok: false,
        error: `Root must be an object or array (got ${kind})`,
        value: EMPTY_ROOT,
        reason: 'invalid-root',
      });
    },
  );

  it('rejects syntax errors without a fallback value', () => {
    const result = parseJsonSource('{a:');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.value).toBeUndefined();
      expect(result.reason).toBeUndefined();
    }
  });

  it('trims source only for emptiness checks; parses full JSON body', () => {
    const result = parseJsonSource('  {"x": true}  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ x: true });
    }
  });
});
