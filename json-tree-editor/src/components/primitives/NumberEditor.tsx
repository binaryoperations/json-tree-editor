import { type Component, createEffect, createSignal, Show, untrack } from 'solid-js';

import { mintEditSessionId } from '../../lib/editor-runtime/meta';
import { parseCompleteNumber } from '../../lib/json-path';
import { HighlightText } from './HighlightText';

export type NumberEditorCommitOpts = {
  /** Focus-session id for history coalesce (`set-value:path:sessionId`). */
  sessionId: string;
};

export type NumberEditorProps = {
  value: number;
  onCommit: (next: number, opts?: NumberEditorCommitOpts) => void;
  /** Debounced search query; when set and unfocused, show `<mark>` highlights. */
  highlightQuery?: string;
  activeHighlight?: boolean;
};

/**
 * Number field with a local draft string.
 *
 * Incomplete text (`-`, `1.`, `1e`) stays local and never writes NaN.
 * Complete finite numbers **live-commit** when they differ from `props.value`
 * (same focus-session coalesce key pattern as strings — one undo step per
 * focus session while typing 10→11→12). Blur/Enter still normalizes or reverts
 * incomplete drafts. Draft is not rewritten to `String(n)` mid-type (e.g. `"1e2"`
 * stays free after committing `100`).
 */
export const NumberEditor: Component<NumberEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(String(props.value));
  const [focused, setFocused] = createSignal(false);
  /** Minted on focus; cleared on blur — drives path-scoped number coalesce. */
  const [sessionId, setSessionId] = createSignal<string | null>(null);

  // Resync draft when props.value changes — including while focused (history undo).
  // While focused, skip rewrite when the draft already parses to the external
  // value so live-commit of 100 does not clobber typing `"1e2"`. Incomplete
  // drafts are not tracked here (untrack) so mid-edit `"1e"` is not reset.
  createEffect(() => {
    const external = props.value;
    if (focused()) {
      const parsed = untrack(() => parseCompleteNumber(draft()));
      if (parsed !== undefined && Object.is(parsed, external)) {
        return;
      }
    }
    setDraft(String(external));
  });

  const commitOpts = (): NumberEditorCommitOpts | undefined => {
    const sid = sessionId();
    return sid != null ? { sessionId: sid } : undefined;
  };

  /** Live-commit when `text` is a complete finite number different from props. */
  const liveCommitIfChanged = (text: string) => {
    const n = parseCompleteNumber(text);
    if (n === undefined) return;
    if (Object.is(n, props.value)) return;
    props.onCommit(n, commitOpts());
  };

  const commitDraft = () => {
    // Capture draft before clearing focus — the sync effect tracks focused and
    // props.value; unfocusing first can reset draft from a stale external value
    // before onCommit lands.
    const text = draft();
    const n = parseCompleteNumber(text);
    if (n === undefined) {
      setDraft(String(props.value));
    } else {
      // Normalize display on blur (e.g. "1e2" → "100").
      setDraft(String(n));
      if (!Object.is(n, props.value)) {
        props.onCommit(n, commitOpts());
      }
    }
    setFocused(false);
    setSessionId(null);
  };

  const beginFocus = () => {
    setFocused(true);
    setSessionId(mintEditSessionId());
  };

  const showHighlight = () =>
    !focused() && (props.highlightQuery?.trim().length ?? 0) > 0;

  return (
    <Show
      when={showHighlight()}
      fallback={
        <input
          class="json-tree-input json-tree-input--number"
          part="input"
          type="text"
          inputMode="decimal"
          value={draft()}
          aria-label="Number value"
          ref={(el) => {
            if (focused()) {
              queueMicrotask(() => el.focus());
            }
          }}
          onFocus={beginFocus}
          onInput={(e) => {
            const text = e.currentTarget.value;
            setDraft(text);
            liveCommitIfChanged(text);
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
      }
    >
      <span
        class="json-tree-input json-tree-input--number json-tree-input--readonly json-tree-input--search-display"
        part="value"
        role="textbox"
        tabindex={0}
        aria-label="Number value"
        onClick={beginFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            beginFocus();
          }
        }}
      >
        <HighlightText
          text={String(props.value)}
          query={props.highlightQuery ?? ''}
          active={props.activeHighlight}
        />
      </span>
    </Show>
  );
};
