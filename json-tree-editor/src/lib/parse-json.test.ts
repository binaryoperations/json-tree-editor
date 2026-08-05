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

  it('falls back to JS expression eval for non-strict object literals', () => {
    const unquoted = parseJsonSource('{ a: 1, b: "x" }');
    expect(unquoted).toMatchObject({ ok: true, value: { a: 1, b: 'x' } });

    const trailing = parseJsonSource('{ a: 1, }');
    expect(trailing).toMatchObject({ ok: true, value: { a: 1 } });

    const arr = parseJsonSource('[1, 2,]');
    expect(arr).toMatchObject({ ok: true, value: [1, 2] });
  });

  it('still rejects non-container roots after Function fallback', () => {
    // Not valid JSON; Function would yield a number.
    const result = parseJsonSource('1 + 1');
    expect(result).toEqual({
      ok: false,
      error: 'Root must be an object or array (got number)',
      value: EMPTY_ROOT,
      reason: 'invalid-root',
    });
  });

  it('rejects function values (no silent drop via JSON.stringify)', () => {
    const named = parseJsonSource('{ a: function () { return 1; } }');
    expect(named.ok).toBe(false);
    if (!named.ok) {
      expect(named.error).toMatch(/function/i);
      expect(named.value).toBeUndefined();
    }

    const arrow = parseJsonSource('{ a: () => 1 }');
    expect(arrow.ok).toBe(false);
    if (!arrow.ok) {
      expect(arrow.error).toMatch(/function/i);
      expect(arrow.value).toBeUndefined();
    }

    const inArray = parseJsonSource('[function () {}]');
    expect(inArray.ok).toBe(false);
    if (!inArray.ok) {
      expect(inArray.error).toMatch(/function/i);
    }
  });

  it('allows Date values and normalizes them to ISO strings', () => {
    const result = parseJsonSource(`{
      "id": 7,
      "email": "dev@example.com",
      "date": new Date("2020-01-15T12:00:00.000Z")
    }`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        id: 7,
        email: 'dev@example.com',
        date: '2020-01-15T12:00:00.000Z',
      });
      expect(result.pretty).toContain('2020-01-15T12:00:00.000Z');
      // Tree value is plain JSON — not a live Date instance.
      expect(
        (result.value as { date: unknown }).date,
      ).not.toBeInstanceOf(Date);
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
