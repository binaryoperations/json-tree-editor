/** Document root must be a JSON object or array (never a primitive). */
export type JsonRootValue = Record<string, unknown> | unknown[];

/** Canonical empty-object fallback when the document is blank or root is not a container. */
export const EMPTY_ROOT: JsonRootValue = {};

/**
 * Result of parsing document source.
 *
 * - `ok: true` — root is a valid object or array (blank source → `{}`).
 * - `ok: false` with `value` — recoverable invalid root (primitive). `value`
 *   is the normalized tree to show (`{}`).
 * - `ok: false` without `value` — syntax / parse error. The tree view should
 *   keep showing the previous valid root when available.
 */
export type JsonValidity =
  | { ok: true; pretty: string; value: JsonRootValue }
  | {
      ok: false;
      error: string;
      /**
       * Normalized tree for display when the failure is an invalid
       * (non-container) root. Omitted for syntax errors.
       */
      value?: JsonRootValue;
      /** Why a fallback `value` was produced. */
      reason?: 'invalid-root';
    };

/** True when value is a non-null object or array (valid document root). */
export function isJsonRootValue(value: unknown): value is JsonRootValue {
  return value !== null && typeof value === 'object';
}

/**
 * Parse source and return pretty text or error message. Does not block typing.
 *
 * Document rules:
 * - Blank / whitespace-only source → valid empty object `{}` (no error).
 * - Root must be an object or array — never string / number / boolean / null
 *   (invalid root → error + empty-object fallback).
 * - Syntax errors report `error` only (no `value`); UI keeps the last good tree.
 */
export function parseJsonSource(source: string): JsonValidity {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return {
      ok: true,
      pretty: JSON.stringify(EMPTY_ROOT, null, 2),
      value: EMPTY_ROOT,
    };
  }
  try {
    const value: unknown = JSON.parse(source);
    if (!isJsonRootValue(value)) {
      const kind = value === null ? 'null' : typeof value;
      return {
        ok: false,
        error: `Root must be an object or array (got ${kind})`,
        value: EMPTY_ROOT,
        reason: 'invalid-root',
      };
    }
    return { ok: true, pretty: JSON.stringify(value, null, 2), value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
