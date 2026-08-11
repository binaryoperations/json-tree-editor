import { type Component, createEffect, createSignal, Show } from 'solid-js';

import { HighlightText } from './HighlightText';

export type StringEditorProps = {
  value: string;
  onCommit: (next: string) => void;
  /** Debounced search query; when set and unfocused, show `<mark>` highlights. */
  highlightQuery?: string;
  activeHighlight?: boolean;
};

/** Local draft while focused so live source sync does not reset the caret. */
export const StringEditor: Component<StringEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(props.value);
  const [focused, setFocused] = createSignal(false);

  createEffect(() => {
    const v = props.value;
    if (!focused()) setDraft(v);
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
          onFocus={() => setFocused(true)}
          onInput={(e) => {
            const next = e.currentTarget.value;
            setDraft(next);
            props.onCommit(next);
          }}
          onBlur={() => setFocused(false)}
        />
      }
    >
      <span
        class="json-tree-input json-tree-input--string json-tree-input--readonly json-tree-input--search-display"
        part="value"
        role="textbox"
        tabindex={0}
        aria-label="String value"
        onClick={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFocused(true);
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
