/** Path segments into a JSON value (object keys or array indices). */
export type JsonPath = (string | number)[];

/**
 * Path-key for the document root. Include this in expanded sets so the root
 * container starts open (see {@link pathKey} with an empty path).
 */
export const ROOT_PATH_KEY = '';

/** Stable string key for expand/collapse sets. */
export function pathKey(path: JsonPath): string {
  return path.length === 0 ? ROOT_PATH_KEY : path.map(String).join('\0');
}

/**
 * Collect path keys for every object/array (container) in document order (DFS).
 * Used by expand-all. Primitives are omitted — only containers need expand state.
 */
export function collectContainerPathKeys(value: unknown): string[] {
  const keys: string[] = [];

  const walk = (v: unknown, path: JsonPath): void => {
    if (v === null || typeof v !== 'object') return;
    keys.push(pathKey(path));
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) {
        walk(v[i], [...path, i]);
      }
      return;
    }
    const obj = v as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      walk(obj[k], [...path, k]);
    }
  };

  walk(value, []);
  return keys;
}

/** Default expanded set: only the root container is open. */
export function defaultExpandedPaths(): Set<string> {
  return new Set([ROOT_PATH_KEY]);
}

/**
 * Visible tree rows in depth-first order: a node is visible when every ancestor
 * container is expanded. Root is always included.
 */
export function collectVisiblePaths(
  root: unknown,
  expanded: Set<string>,
): JsonPath[] {
  const paths: JsonPath[] = [];

  const walk = (value: unknown, path: JsonPath): void => {
    paths.push(path);
    if (value === null || typeof value !== 'object') return;
    if (!expanded.has(pathKey(path))) return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        walk(value[i], [...path, i]);
      }
      return;
    }
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      walk(obj[k], [...path, k]);
    }
  };

  walk(root, []);
  return paths;
}

/** DOM-safe id for a path (for data attributes / querySelector). */
export function pathDomId(path: JsonPath): string {
  return JSON.stringify(path);
}

/** Read value at path; returns undefined if path is invalid. */
export function getAtPath(root: unknown, path: JsonPath): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return cur;
}

/** Immutable set at path. Replaces root when path is empty. */
export function setAtPath(root: unknown, path: JsonPath, value: unknown): unknown {
  if (path.length === 0) return value;

  const [head, ...rest] = path;

  if (Array.isArray(root)) {
    const next = root.slice();
    const idx = head as number;
    next[idx] = setAtPath(root[idx], rest, value);
    return next;
  }

  if (root !== null && typeof root === 'object') {
    const obj = root as Record<string, unknown>;
    const key = String(head);
    return {
      ...obj,
      [key]: setAtPath(obj[key], rest, value),
    };
  }

  return value;
}

/** Immutable delete at path (object key or array index). No-op for empty path. */
export function deleteAtPath(root: unknown, path: JsonPath): unknown {
  if (path.length === 0) return root;

  if (path.length === 1) {
    const head = path[0];
    if (Array.isArray(root)) {
      const next = root.slice();
      next.splice(head as number, 1);
      return next;
    }
    if (root !== null && typeof root === 'object') {
      const next = { ...(root as Record<string, unknown>) };
      delete next[String(head)];
      return next;
    }
    return root;
  }

  const [head, ...rest] = path;

  if (Array.isArray(root)) {
    const next = root.slice();
    const idx = head as number;
    next[idx] = deleteAtPath(root[idx], rest);
    return next;
  }

  if (root !== null && typeof root === 'object') {
    const obj = root as Record<string, unknown>;
    const key = String(head);
    return {
      ...obj,
      [key]: deleteAtPath(obj[key], rest),
    };
  }

  return root;
}

/**
 * Rename an object key at `parentPath` from `oldKey` to `newKey`.
 * Preserves insertion order as much as possible. No-op if key missing or collision.
 */
export function renameKeyAtPath(
  root: unknown,
  parentPath: JsonPath,
  oldKey: string,
  newKey: string,
): unknown {
  if (oldKey === newKey || newKey.length === 0) return root;

  const parent = getAtPath(root, parentPath);
  if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
    return root;
  }

  const obj = parent as Record<string, unknown>;
  if (!(oldKey in obj) || newKey in obj) return root;

  const next: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    next[k === oldKey ? newKey : k] = obj[k];
  }

  return setAtPath(root, parentPath, next);
}

/** Add a new property to the object at path. */
export function addPropertyAtPath(
  root: unknown,
  path: JsonPath,
  key: string,
  value: unknown = null,
): unknown {
  const parent = getAtPath(root, path);
  if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
    return root;
  }
  const obj = parent as Record<string, unknown>;
  if (key in obj) return root;
  return setAtPath(root, path, { ...obj, [key]: value });
}

/** Append an item to the array at path. */
export function addItemAtPath(
  root: unknown,
  path: JsonPath,
  value: unknown = null,
): unknown {
  const parent = getAtPath(root, path);
  if (!Array.isArray(parent)) return root;
  return setAtPath(root, path, [...parent, value]);
}

/**
 * Clone the *shape* of a JSON value for new array items / object properties.
 * - null → null
 * - string → ""
 * - number → 0
 * - boolean → false
 * - array → **one** item shaped like the last element (empty → `[null]`)
 * - object → same keys with recursively shaped values
 *
 * Leaf values are cleared to type defaults (not deep-copied content).
 * Arrays never preserve length — new siblings always start with a single slot.
 */
export function cloneJsonShape(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return [null];
    // Prefer last element (same policy as sibling templates); always length 1.
    return [cloneJsonShape(value[value.length - 1])];
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = cloneJsonShape(v);
    }
    return out;
  }
  return null;
}

/**
 * Template value for a new sibling in a container.
 * Prefers the **last** entry's shape; if the container is empty, falls back to
 * `null`. For objects, "last" is the last key in insertion order.
 */
export function siblingTemplateShape(container: unknown): unknown {
  if (Array.isArray(container)) {
    if (container.length === 0) return null;
    // Prefer last; first is the same when length === 1.
    return cloneJsonShape(container[container.length - 1]);
  }
  if (container !== null && typeof container === 'object') {
    const keys = Object.keys(container as Record<string, unknown>);
    if (keys.length === 0) return null;
    const lastKey = keys[keys.length - 1];
    return cloneJsonShape((container as Record<string, unknown>)[lastKey]);
  }
  return null;
}

/**
 * Append an item shaped like the last array element.
 * Empty arrays still append `null`.
 */
export function addShapedItemAtPath(root: unknown, path: JsonPath): unknown {
  const parent = getAtPath(root, path);
  if (!Array.isArray(parent)) return root;
  return addItemAtPath(root, path, siblingTemplateShape(parent));
}

/**
 * Add a property shaped like the last existing property value.
 * Empty objects still insert `null`.
 */
export function addShapedPropertyAtPath(
  root: unknown,
  path: JsonPath,
  key: string,
): unknown {
  const parent = getAtPath(root, path);
  if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
    return root;
  }
  return addPropertyAtPath(root, path, key, siblingTemplateShape(parent));
}

/** Generate a unique object key. */
export function uniqueObjectKey(
  obj: Record<string, unknown>,
  base = 'key',
): string {
  if (!(base in obj)) return base;
  let i = 1;
  while (`${base}${i}` in obj) i += 1;
  return `${base}${i}`;
}

export type JsonTypeName =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array';

/**
 * Parse a *complete* JSON-style number from editor draft text.
 *
 * Returns `undefined` for empty/incomplete/invalid drafts (`""`, `"-"`, `"1."`,
 * `"1e"`, `"1e-"`, hex, leading `+`, leading zeros) so number fields can keep a
 * local string without writing `NaN` into the tree. `Number("1.") === 1` is
 * intentionally rejected until a fractional digit is present.
 */
export function parseCompleteNumber(text: string): number | undefined {
  const t = text.trim();
  if (t.length === 0) return undefined;
  // Optional minus, integer (0 or no-leading-zero), optional .frac, optional exp.
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(t)) {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Interpret free-text typed over a `null` leaf into a JSON value.
 *
 * - empty / whitespace → `null` (keep null type)
 * - `JSON.parse` succeeds → use the parsed value (object, array, number,
 *   boolean, null, or quoted string)
 * - `JSON.parse` fails → complete number if possible, otherwise a string
 */
export function parseNullEditorDraft(text: string): unknown {
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const n = parseCompleteNumber(text);
    if (n !== undefined) return n;
    return text;
  }
}

export function jsonTypeOf(value: unknown): JsonTypeName {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  if (t === 'object') return 'object';
  return 'string';
}

/** Default property name used when seeding a new object. */
export const DEFAULT_OBJECT_KEY = 'key';

/**
 * New object with a single key. When converting from a primitive (or null),
 * that value is kept under the key — e.g. `42` → `{ key: 42 }`.
 */
export function defaultNewObject(
  seed: unknown = null,
): Record<string, unknown> {
  return { [DEFAULT_OBJECT_KEY]: seed };
}

/**
 * New array with a single item. When converting from a primitive (or null),
 * that value is the item — e.g. `42` → `[42]`.
 */
export function defaultNewArray(seed: unknown = null): unknown[] {
  return [seed];
}

/** Convert a value to a different JSON type (best-effort). */
export function convertJsonType(value: unknown, to: JsonTypeName): unknown {
  switch (to) {
    case 'string':
      // Always reset to empty when (re)typing as string.
      return '';
    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    }
    case 'boolean':
      // Always reset to false when (re)typing as boolean.
      return false;
    case 'null':
      return null;
    case 'object':
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
      // One key; keep the previous value (primitive, null, or whole array).
      return defaultNewObject(value);
    case 'array':
      if (Array.isArray(value)) return value;
      // One item holding the previous value (primitive, null, or whole object).
      return defaultNewArray(value);
    default:
      return value;
  }
}
