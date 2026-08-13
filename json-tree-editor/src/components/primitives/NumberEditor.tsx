import { type Component, createEffect, createSignal, Show } from 'solid-js';

import { parseCompleteNumber } from '../../lib/json-path';
import { HighlightText } from './HighlightText';

export type NumberEditorProps = {
  value: number;
  onCommit: (next: number) => void;
  /** Debounced search query; when set and unfocused, show `<mark>` highlights. */
  highlightQuery?: string;
  activeHighlight?: boolean;
};

/**
 * Number field with a local draft string.
 *
 * Incomplete text (`-`, `1.`, `1e`) stays local and never writes NaN.
 * Complete finite numbers commit on blur/Enter (normalize or revert). Focus is
 * cleared *after* commit so the external-value sync effect cannot clobber the
 * draft with a stale props.value mid-commit.
 */
export const NumberEditor: Component<NumberEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(String(props.value));
  const [focused, setFocused] = createSignal(false);

  // Resync draft when props.value changes — including while focused (history undo).
  // Incomplete local typing does not change props.value, so the draft stays free.
  createEffect(() => {
    setDraft(String(props.value));
  });

  /** Commit when `text` is a complete finite number. Optionally normalize draft. */
  const tryCommit = (text: string, normalize: boolean): boolean => {
    const n = parseCompleteNumber(text);
    if (n === undefined) return false;

    if (normalize) setDraft(String(n));
    return true;
  };

  const commitDraft = () => {
    // Capture draft before clearing focus — the sync effect tracks both
    // focused and props.value; unfocusing first can reset draft from the
    // still-stale external value before onCommit lands.
    const text = draft();
    if (!tryCommit(text, true)) {
      setDraft(String(props.value));
    }

    const n = parseCompleteNumber(draft());
    if (n !== undefined) {
      props.onCommit(n);
    }
    setFocused(false);
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
          onFocus={() => setFocused(true)}
          onInput={(e) => {
            const text = e.currentTarget.value;
            setDraft(text);
            // Live-commit only complete numbers; leave draft free for in-progress text.
            // tryCommit(text, false);
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
        onClick={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFocused(true);
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
