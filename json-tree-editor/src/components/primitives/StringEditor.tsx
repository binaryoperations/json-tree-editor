import { type Component, createEffect, createSignal, Show } from 'solid-js';

import { mintEditSessionId } from '../../lib/editor-runtime/meta';
import { HighlightText } from './HighlightText';

export type StringEditorCommitOpts = {
  /** Focus-session id for history coalesce (`set-value:path:sessionId`). */
  sessionId: string;
};

export type StringEditorProps = {
  value: string;
  onCommit: (next: string, opts?: StringEditorCommitOpts) => void;
  /** Debounced search query; when set and unfocused, show `<mark>` highlights. */
  highlightQuery?: string;
  activeHighlight?: boolean;
};

/** Local draft while focused so live source sync does not reset the caret. */
export const StringEditor: Component<StringEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(props.value);
  const [focused, setFocused] = createSignal(false);
  /** Minted on focus; cleared on blur — drives path-scoped string coalesce. */
  const [sessionId, setSessionId] = createSignal<string | null>(null);

  // Resync draft from props whenever value changes — including while focused
  // (history undo / external apply). Local typing already matches props after
  // commit; incomplete external lag is acceptable vs stale draft after undo.
  createEffect(() => {
    setDraft(props.value);
  });

  const showHighlight = () =>
    !focused() && (props.highlightQuery?.trim().length ?? 0) > 0;

  return (
    <Show
      when={showHighlight()}
      fallback={
        <input
          class="json-tree-input json-tree-input--string"
          part="input"
          type="text"
          value={draft()}
          aria-label="String value"
          ref={(el) => {
            if (focused()) {
              queueMicrotask(() => el.focus());
            }
          }}
          onFocus={() => {
            setFocused(true);
            setSessionId(mintEditSessionId());
          }}
          onInput={(e) => {
            const next = e.currentTarget.value;
            setDraft(next);
            const sid = sessionId();
            props.onCommit(
              next,
              sid != null ? { sessionId: sid } : undefined,
            );
          }}
          onBlur={() => {
            setFocused(false);
            setSessionId(null);
          }}
        />
      }
    >
      <span
        class="json-tree-input json-tree-input--string json-tree-input--readonly json-tree-input--search-display"
        part="value"
        role="textbox"
        tabindex={0}
        aria-label="String value"
        onClick={() => {
          setFocused(true);
          setSessionId(mintEditSessionId());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFocused(true);
            setSessionId(mintEditSessionId());
          }
        }}
      >
        <HighlightText
          text={props.value}
          query={props.highlightQuery ?? ''}
          active={props.activeHighlight}
        />
      </span>
    </Show>
  );
};
