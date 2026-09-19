export type JsonPath = (string | number)[];

export function pointerToJsonPath(ptr: string): JsonPath {
  if (!ptr) return [];
  const parts = ptr.split('/');
  if (parts.length === 0) return [];
  const segs = parts.slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  return segs.map((p) => (/^-?\d+$/.test(p) ? Number(p) : p));
}

export function jsonPathToPointer(path: JsonPath): string {
  if (!path || path.length === 0) return '';
  return '/' + path.map((p) => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}
