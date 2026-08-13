import type { JsonPath } from '../json-path';
import { pathKey } from '../json-path';
import type {
  EditorCommitKind,
  EditorCommitMeta,
  EditorCommitMetaInput,
  EditorCommitOrigin,
} from './types';

/** Build a complete {@link EditorCommitMeta} with defaults. */
export function buildCommitMeta(
  origin: EditorCommitOrigin,
  partial: EditorCommitMetaInput &
    Partial<Pick<EditorCommitMeta, 'echo'>> = {},
): EditorCommitMeta {
  return {
    origin,
    kind: partial.kind ?? 'unknown',
    path: partial.path,
    coalesceKey: partial.coalesceKey,
    skipHistory: partial.skipHistory ?? false,
    echo: partial.echo ?? false,
    toKey: partial.toKey,
    fromIndex: partial.fromIndex,
    toIndex: partial.toIndex,
    newPath: partial.newPath,
    newKey: partial.newKey,
    newIndex: partial.newIndex,
  };
}

/**
 * Normative coalesce key for leaf **string** live edits.
 *
 * When `sessionId` is provided (minted on StringEditor focus, cleared on blur):
 * `set-value:${pathKey}:${sessionId}` — one undo step per focus session.
 *
 * Bare `set-value:${pathKey}` (no session) must **not** be used for multi-keystroke
 * string typing; history will not treat it as infinite coalesce.
 */
export function setValueCoalesceKey(
  path: JsonPath,
  sessionId?: string,
): string {
  const base = `set-value:${pathKey(path)}`;
  if (sessionId != null && sessionId.length > 0) {
    return `${base}:${sessionId}`;
  }
  return base;
}

/** True when a coalesce key encodes a string focus session (has session segment). */
export function isSessionCoalesceKey(coalesceKey: string | undefined): boolean {
  if (!coalesceKey) return false;
  // set-value:<pathKey>:<sessionId> — pathKey may contain ":" only if we used
  // pathKey (null-separated). Session form has at least 3 colon-separated parts
  // when path is non-root; for root pathKey is "" → "set-value::sessionId".
  if (!coalesceKey.startsWith('set-value:')) return false;
  const rest = coalesceKey.slice('set-value:'.length);
  // session form: `${pathKey}:${sessionId}` — always contains at least one ":"
  // after the prefix when sessionId is present (pathKey + ":" + sessionId).
  return rest.includes(':');
}

/** UI structural / value commit meta helper. */
export function uiCommitMeta(
  kind: EditorCommitKind,
  path?: JsonPath,
  extra?: Omit<EditorCommitMetaInput, 'kind' | 'path'>,
): EditorCommitMeta {
  return buildCommitMeta('ui', {
    kind,
    path,
    ...extra,
    echo: false,
  });
}

/** Mint a unique focus-session id for string live-edit coalescing. */
export function mintEditSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
