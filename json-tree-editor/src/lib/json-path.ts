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
  return collectSubtreeContainerPathKeys(value, []);
}

/**
 * Paths of container nodes that are **direct children** of `parentPath`.
 * Does not include the parent itself. Empty when the parent is missing or not
 * a container, or when no child is an object/array.
 */
export function collectChildContainerPaths(
  root: unknown,
  parentPath: JsonPath,
): JsonPath[] {
  const parent = getAtPath(root, parentPath);
  if (!isJsonContainer(parent)) return [];

  const paths: JsonPath[] = [];
  if (Array.isArray(parent)) {
    for (let i = 0; i < parent.length; i += 1) {
      if (isJsonContainer(parent[i])) {
        paths.push([...parentPath, i]);
      }
    }
    return paths;
  }

  const obj = parent as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (isJsonContainer(obj[k])) {
      paths.push([...parentPath, k]);
    }
  }
  return paths;
}

/**
 * Path keys for container nodes that are **direct children** of `parentPath`.
 * Does not include the parent itself. Empty when the parent is missing or not
 * a container, or when no child is an object/array.
 */
export function collectChildContainerPathKeys(
  root: unknown,
  parentPath: JsonPath,
): string[] {
  return collectChildContainerPaths(root, parentPath).map(pathKey);
}

/**
 * Paths for every container in the subtree at `path` (DFS), including the
 * node at `path` when it is a container. Empty when the value is missing or a
 * primitive.
 */
export function collectSubtreeContainerPaths(
  root: unknown,
  path: JsonPath,
): JsonPath[] {
  const value = path.length === 0 ? root : getAtPath(root, path);
  const paths: JsonPath[] = [];

  const walk = (v: unknown, p: JsonPath): void => {
    if (!isJsonContainer(v)) return;
    paths.push(p);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) {
        walk(v[i], [...p, i]);
      }
      return;
    }
    const obj = v as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      walk(obj[k], [...p, k]);
    }
  };

  walk(value, path);
  return paths;
}

/**
 * Path keys for every container in the subtree at `path` (DFS), including the
 * node at `path` when it is a container. Empty when the value is missing or a
 * primitive.
 */
export function collectSubtreeContainerPathKeys(
  root: unknown,
  path: JsonPath,
): string[] {
  return collectSubtreeContainerPaths(root, path).map(pathKey);
}

/**
 * Container paths under `path` **excluding** `path` itself (nested only).
 * Used for collapse enablement: any expanded descendant can be collapsed.
 */
export function collectDescendantContainerPaths(
  root: unknown,
  path: JsonPath,
): JsonPath[] {
  return collectSubtreeContainerPaths(root, path).filter(
    (p) => p.length > path.length,
  );
}

/** Default expanded set: only the root container is open. */
export function defaultExpandedPaths(): Set<string> {
  return new Set([ROOT_PATH_KEY]);
}

/**
 * Expand path keys for every container whose path depth is ≤ `maxDepth`.
 *
 * - Depth `0` → root only (`ROOT_PATH_KEY`)
 * - Depth `1` → root + each direct child container
 * - Depth `n` → all containers at path length ≤ `n`
 *
 * Non-finite or negative `maxDepth` is treated as `0`.
 */
export function expandedPathsUpToDepth(
  value: unknown,
  maxDepth: number,
): Set<string> {
  const depth =
    typeof maxDepth === 'number' && Number.isFinite(maxDepth)
      ? Math.max(0, Math.floor(maxDepth))
      : 0;
  const keys = new Set<string>();

  const walk = (v: unknown, path: JsonPath): void => {
    if (!isJsonContainer(v)) return;
    if (path.length <= depth) {
      keys.add(pathKey(path));
    }
    // No need to walk deeper than depth+1 for collecting open containers.
    if (path.length >= depth) return;
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
  // Always include root when the value is a container (or empty fallback).
  if (keys.size === 0) keys.add(ROOT_PATH_KEY);
  return keys;
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
    if (!isJsonContainer(value)) return;
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

/**
 * Insert a value at `path` (array splice or object key insert with order).
 *
 * - **Array parent:** last segment is the insert index; siblings shift right
 *   (`splice(index, 0, value)`). Index is clamped to `[0, length]`.
 * - **Object parent:** last segment is the new key. Optional `keyIndex` places
 *   the key among existing keys (clamped to `[0, keys.length]`); omit to append.
 *
 * No-op when path is empty, parent is missing / wrong type, or object key
 * already exists. Returns a new root (immutable).
 */
export function insertAtPath(
  root: unknown,
  path: JsonPath,
  value: unknown,
  options?: { keyIndex?: number },
): unknown {
  if (path.length === 0) return root;

  if (path.length === 1) {
    return insertAtParent(root, path[0], value, options?.keyIndex);
  }

  const [head, ...rest] = path;

  if (Array.isArray(root)) {
    const next = root.slice();
    const idx = head as number;
    next[idx] = insertAtPath(root[idx], rest, value, options);
    return next;
  }

  if (root !== null && typeof root === 'object') {
    const obj = root as Record<string, unknown>;
    const key = String(head);
    return {
      ...obj,
      [key]: insertAtPath(obj[key], rest, value, options),
    };
  }

  return root;
}

function insertAtParent(
  parent: unknown,
  segment: string | number,
  value: unknown,
  keyIndex?: number,
): unknown {
  if (Array.isArray(parent)) {
    if (typeof segment !== 'number' || !Number.isInteger(segment)) {
      return parent;
    }
    const len = parent.length;
    const index =
      typeof segment === 'number' && Number.isFinite(segment)
        ? Math.max(0, Math.min(len, Math.floor(segment)))
        : len;
    const next = parent.slice();
    next.splice(index, 0, value);
    return next;
  }

  if (parent !== null && typeof parent === 'object') {
    const obj = parent as Record<string, unknown>;
    const key = String(segment);
    if (key in obj) return parent;

    const keys = Object.keys(obj);
    let at =
      typeof keyIndex === 'number' && Number.isFinite(keyIndex)
        ? Math.max(0, Math.min(keys.length, Math.floor(keyIndex)))
        : keys.length;

    const next: Record<string, unknown> = {};
    let inserted = false;
    for (let i = 0; i < keys.length; i += 1) {
      if (i === at) {
        next[key] = value;
        inserted = true;
      }
      next[keys[i]] = obj[keys[i]];
    }
    if (!inserted) {
      next[key] = value;
    }
    return next;
  }

  return parent;
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
  if (value instanceof Date) return '';
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

/**
 * Deep-clone a JSON value (structure + content).
 * `undefined` is returned as-is (JSON.stringify would not produce a string).
 */
export function deepCloneJson(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/**
 * Duplicate an object or array node at `path` as the next sibling under its parent.
 * Deep-clones the entire value (not a shape template).
 * No-op for the document root, primitives, or invalid paths.
 *
 * - Array parent: insert clone immediately after the index.
 * - Object parent: insert a unique key (based on the source key) right after it.
 */
export function duplicateAtPath(root: unknown, path: JsonPath): unknown {
  if (path.length === 0) return root;

  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const parent = getAtPath(root, parentPath);
  const current = getAtPath(root, path);
  // Only containers (object / array) may be duplicated.
  if (current === null || typeof current !== 'object') return root;
  const clone = deepCloneJson(current);

  if (Array.isArray(parent)) {
    if (typeof last !== 'number') return root;
    const next = parent.slice();
    next.splice(last + 1, 0, clone);
    return setAtPath(root, parentPath, next);
  }

  if (parent !== null && typeof parent === 'object') {
    const obj = parent as Record<string, unknown>;
    const oldKey = String(last);
    if (!(oldKey in obj)) return root;
    const newKey = uniqueObjectKey(obj, oldKey);
    const next: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      next[k] = obj[k];
      if (k === oldKey) {
        next[newKey] = clone;
      }
    }
    return setAtPath(root, parentPath, next);
  }

  return root;
}

/**
 * Key that {@link duplicateAtPath} would assign when duplicating an object
 * property at `path`. Returns `null` for root / non-object parents.
 */
export function duplicateKeyAtPath(
  root: unknown,
  path: JsonPath,
): string | null {
  if (path.length === 0) return null;
  const parent = getAtPath(root, path.slice(0, -1));
  if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
    return null;
  }
  const oldKey = String(path[path.length - 1]);
  return uniqueObjectKey(parent as Record<string, unknown>, oldKey);
}

/**
 * Move an array item at `path` to a new index within the same array.
 *
 * `path` must end with a numeric array index. `toIndex` is clamped to
 * `[0, length - 1]`. No-op when the path is invalid, the parent is not an
 * array, or the item is already at the target index (returns the same root).
 */
export function moveArrayItemAtPath(
  root: unknown,
  path: JsonPath,
  toIndex: number,
): unknown {
  if (path.length === 0) return root;
  const last = path[path.length - 1];
  if (typeof last !== 'number' || !Number.isInteger(last) || last < 0) {
    return root;
  }

  const parentPath = path.slice(0, -1);
  const parent = getAtPath(root, parentPath);
  if (!Array.isArray(parent)) return root;
  if (last >= parent.length) return root;

  const len = parent.length;
  if (len <= 1) return root;

  const target =
    typeof toIndex === 'number' && Number.isFinite(toIndex)
      ? Math.max(0, Math.min(len - 1, Math.floor(toIndex)))
      : last;
  if (target === last) return root;

  const next = parent.slice();
  const [item] = next.splice(last, 1);
  next.splice(target, 0, item);
  return setAtPath(root, parentPath, next);
}

/**
 * Move an array item at `path` by `delta` positions (−1 = up, +1 = down).
 * No-op when the move would leave the array bounds or change nothing.
 */
export function moveArrayItemByDelta(
  root: unknown,
  path: JsonPath,
  delta: number,
): unknown {
  if (path.length === 0) return root;
  const last = path[path.length - 1];
  if (typeof last !== 'number' || !Number.isInteger(last)) return root;
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) {
    return root;
  }
  return moveArrayItemAtPath(root, path, last + Math.trunc(delta));
}

/**
 * Resolve the destination index for a drag-and-drop reorder.
 *
 * `overIndex` is the row under the pointer; `edge` is which half of that row
 * (`before` = top, `after` = bottom). Accounts for the source index being
 * removed before insert (same rules as a typical sortable list).
 */
export function arrayDropTargetIndex(
  fromIndex: number,
  overIndex: number,
  edge: 'before' | 'after',
): number {
  let to = edge === 'before' ? overIndex : overIndex + 1;
  if (fromIndex < to) to -= 1;
  return to;
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

/**
 * True for object/array containers the tree can expand.
 * `Date` is a leaf (JSON form is an ISO string), not a container.
 */
export function isJsonContainer(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  return true;
}

/**
 * ISO string for a Date, or `""` if invalid — matches JSON.stringify for valid
 * dates (`toJSON`) and avoids putting a live Date into the tree UI.
 */
export function dateToJsonString(value: Date): string {
  const t = value.getTime();
  if (Number.isNaN(t)) return '';
  return value.toISOString();
}

export function jsonTypeOf(value: unknown): JsonTypeName {
  if (value === null) return 'null';
  // Date serializes to an ISO string — never treat as a JSON object.
  if (value instanceof Date) return 'string';
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
      // Date → ISO; otherwise always reset to empty when (re)typing as string.
      if (value instanceof Date) return dateToJsonString(value);
      return '';
    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      }
      if (value instanceof Date) {
        const t = value.getTime();
        return Number.isNaN(t) ? 0 : t;
      }
      return 0;
    }
    case 'boolean':
      // Always reset to false when (re)typing as boolean.
      return false;
    case 'null':
      return null;
    case 'object':
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        return value;
      }
      // One key; keep the previous value (primitive, null, or whole array).
      return defaultNewObject(
        value instanceof Date ? dateToJsonString(value) : value,
      );
    case 'array':
      if (Array.isArray(value)) return value;
      // One item holding the previous value (primitive, null, or whole object).
      return defaultNewArray(
        value instanceof Date ? dateToJsonString(value) : value,
      );
    default:
      return value;
  }
}
