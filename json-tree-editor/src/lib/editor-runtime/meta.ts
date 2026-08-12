import type { JsonPath } from '../json-path';
import { pathKey } from '../json-path';
import type {
  EditorCommitKind,
  EditorCommitMeta,
  EditorCommitOrigin,
} from './types';

/** Build a complete {@link EditorCommitMeta} with defaults. */
export function buildCommitMeta(
  origin: EditorCommitOrigin,
  partial: Partial<
    Pick<
      EditorCommitMeta,
      'kind' | 'path' | 'coalesceKey' | 'skipHistory' | 'echo'
    >
  > = {},
): EditorCommitMeta {
  return {
    origin,
    kind: partial.kind ?? 'unknown',
    path: partial.path,
    coalesceKey: partial.coalesceKey,
    skipHistory: partial.skipHistory ?? false,
    echo: partial.echo ?? false,
  };
}

/** Normative coalesce key for leaf string sessions (history interprets). */
export function setValueCoalesceKey(path: JsonPath): string {
  return `set-value:${pathKey(path)}`;
}

/** UI structural / value commit meta helper. */
export function uiCommitMeta(
  kind: EditorCommitKind,
  path?: JsonPath,
  extra?: Partial<Pick<EditorCommitMeta, 'coalesceKey' | 'skipHistory'>>,
): EditorCommitMeta {
  return buildCommitMeta('ui', {
    kind,
    path,
    coalesceKey: extra?.coalesceKey,
    skipHistory: extra?.skipHistory,
    echo: false,
  });
}
