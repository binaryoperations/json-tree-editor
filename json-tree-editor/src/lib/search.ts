import {
  type JsonPath,
  dateToJsonString,
  isJsonContainer,
  pathKey,
  ROOT_PATH_KEY,
} from './json-path';

export type SearchMatchField = 'key' | 'value';

export type SearchMatch = {
  path: JsonPath;
  field: SearchMatchField;
};

export type HighlightSegment = {
  text: string;
  match: boolean;
};

/** Case-insensitive substring test. Empty/whitespace query never matches. */
export function textMatches(haystack: string, query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return haystack.toLowerCase().includes(q.toLowerCase());
}

/**
 * Display string for a leaf value (mirrors tree UI).
 * Containers return null (not searchable as values).
 */
export function primitiveDisplayString(value: unknown): string | null {
  if (value === null) return 'null';
  if (value instanceof Date) return dateToJsonString(value);
  if (isJsonContainer(value)) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Unexpected types (undefined, function, …) — stringify for safety.
  return String(value);
}

/**
 * Split `text` into segments alternating non-match / match for rendering.
 * Empty or whitespace-only query → single non-match segment.
 */
export function splitHighlightSegments(
  text: string,
  query: string,
): HighlightSegment[] {
  const q = query.trim();
  if (!q || text.length === 0) {
    return text.length === 0 ? [] : [{ text, match: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const segments: HighlightSegment[] = [];
  let start = 0;

  while (start < text.length) {
    const idx = lowerText.indexOf(lowerQ, start);
    if (idx < 0) {
      segments.push({ text: text.slice(start), match: false });
      break;
    }
    if (idx > start) {
      segments.push({ text: text.slice(start, idx), match: false });
    }
    segments.push({
      text: text.slice(idx, idx + q.length),
      match: true,
    });
    start = idx + q.length;
  }

  return segments;
}

/**
 * Path keys for every ancestor container of `path`, including the root.
 * Used to auto-expand so a match is visible.
 */
export function ancestorPathKeys(path: JsonPath): string[] {
  const keys: string[] = [ROOT_PATH_KEY];
  for (let i = 1; i <= path.length; i += 1) {
    keys.push(pathKey(path.slice(0, i)));
  }
  return keys;
}

/**
 * Collect key/value matches in document order (DFS).
 *
 * - **Keys**: object property names only (not root, not array indices)
 * - **Values**: leaf primitives only
 */
export function collectSearchMatches(
  root: unknown,
  query: string,
): SearchMatch[] {
  const q = query.trim();
  if (!q) return [];

  const matches: SearchMatch[] = [];

  const walk = (value: unknown, path: JsonPath): void => {
    // Object key match (not root, not array index).
    if (path.length > 0) {
      const last = path[path.length - 1];
      if (typeof last === 'string' && textMatches(last, q)) {
        matches.push({ path: path.slice(), field: 'key' });
      }
    }

    if (!isJsonContainer(value)) {
      const display = primitiveDisplayString(value);
      if (display != null && textMatches(display, q)) {
        matches.push({ path: path.slice(), field: 'value' });
      }
      return;
    }

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
  return matches;
}
