export type JsonValidity =
  | { ok: true; pretty: string; value: unknown }
  | { ok: false; error: string };

/** Parse source and return pretty text or error message. Does not block typing. */
export function parseJsonSource(source: string): JsonValidity {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Document is empty' };
  }
  try {
    const value: unknown = JSON.parse(source);
    return { ok: true, pretty: JSON.stringify(value, null, 2), value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
