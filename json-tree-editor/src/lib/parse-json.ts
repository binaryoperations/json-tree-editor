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
  // Date is typeof 'object' but is a JSON string leaf, not a document root.
  return value !== null && typeof value === 'object' && !(value instanceof Date);
}

/**
 * Walk a value and throw if it cannot round-trip through JSON safely.
 *
 * Used on the `new Function` path. Allowed (stringify handles them):
 * - plain JSON types
 * - `Date` → ISO string via `toJSON`
 * - `undefined` / `symbol` → stripped or array-coerced
 *
 * Rejected (would be dropped or become useless `{}`):
 * - functions, BigInt, Map/Set/class instances without a JSON `toJSON`
 */
export function assertJsonData(value: unknown, path = '$'): void {
  if (value === null) return;

  // Date → ISO string via toJSON; allow and stop walking (not a plain object).
  if (value instanceof Date) return;

  switch (typeof value) {
    case 'string':
    case 'boolean':
    // undefined / symbol are stripped (or array-coerced) by JSON.stringify.
    case 'undefined':
    case 'symbol':
      return;
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`Non-finite number is not allowed at ${path}`);
      }
      return;
    case 'function':
      throw new TypeError(
        `Functions are not allowed in JSON documents (at ${path})`,
      );
    case 'bigint':
      throw new TypeError(
        `BigInt is not allowed in JSON documents (at ${path})`,
      );
    case 'object':
      break;
    default:
      throw new TypeError(`Unsupported type at ${path}`);
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      // Holes / missing indices: stringify turns them into null — allow.
      if (!(i in value)) continue;
      assertJsonData(value[i], `${path}[${i}]`);
    }
    return;
  }


  // Reject Map, Set, class instances, etc. (stringify to `{}` or worse).
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const name =
      typeof (value as { constructor?: { name?: string } }).constructor
        ?.name === 'string'
        ? (value as { constructor: { name: string } }).constructor.name
        : 'object';
    throw new TypeError(
      `${name} values are not allowed in JSON documents (at ${path})`,
    );
  }

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    assertJsonData(v, `${path}.${k}`);
  }
}

/** Pretty-print a document root as JSON (2-space indent, no trailing newline). */
export function stringifyJsonDocument(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function invalidRoot(value: unknown): JsonValidity {
  const kind = value === null ? 'null' : typeof value;
  return {
    ok: false,
    error: `Root must be an object or array (got ${kind})`,
    value: EMPTY_ROOT,
    reason: 'invalid-root',
  };
}

/**
 * Parse source and return pretty text or error message. Does not block typing.
 *
 * Document rules:
 * - Blank / whitespace-only source → valid empty object `{}` (no error).
 * - Root must be an object or array — never string / number / boolean / null
 *   (invalid root → error + empty-object fallback).
 * - `JSON.parse` first (already JSON-safe; no extra value walk).
 * - On parse failure, evaluate as a JS expression via `new Function` with
 *   {@link assertJsonData} injected: `(assert(value), value)`. Functions and
 *   non-JSON host objects fail; `Date` is allowed (ISO via stringify).
 * - After a successful Function eval, re-parse the pretty JSON so the tree
 *   value is plain data (`Date` → string, stripped keys gone).
 * - If parse/eval fails without a usable root, report `error` only (no
 *   `value`); UI keeps the last good tree.
 */
export function parseJsonSource(source: string): JsonValidity {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return {
      ok: true,
      pretty: stringifyJsonDocument(EMPTY_ROOT),
      value: EMPTY_ROOT,
    };
  }

  try {
    const value: unknown = JSON.parse(source);
    if (!isJsonRootValue(value)) return invalidRoot(value);
    return { ok: true, pretty: stringifyJsonDocument(value), value };
  } catch {
    // Not strict JSON — try JS expression (unquoted keys, trailing commas, …).
  }

  let value: unknown;
  try {
    // Inject assert so illegal values fail inside the same evaluation.
    value = new Function(
      'assert',
      `"use strict"; return ((value) => (assert(value), value))(${trimmed});`,
    )(assertJsonData);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  if (!isJsonRootValue(value)) return invalidRoot(value);

  // Normalize Date → ISO string, drop undefined keys, etc. into plain JSON.
  try {
    const pretty = stringifyJsonDocument(value);
    const normalized: unknown = JSON.parse(pretty);
    if (!isJsonRootValue(normalized)) return invalidRoot(normalized);
    return { ok: true, pretty, value: normalized };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
