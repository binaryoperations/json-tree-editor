import { type Component, createEffect, createSignal, Show } from 'solid-js';

import { HighlightText } from './HighlightText';

export type KeyEditorProps = {
  label: string;
  onRename: (newKey: string) => void;
  /**
   * When true on mount / when flipped true, enter rename mode immediately
   * (used after +key or converting a value to object).
   */
  autoEdit?: boolean;
  /** Called once after auto-edit mode is entered so the parent can clear the flag. */
  onAutoEditStart?: () => void;
  /** Debounced search query for `<mark>` highlights (display mode only). */
  highlightQuery?: string;
  /** Stronger mark when this key is the active search match. */
  activeHighlight?: boolean;
};

export const KeyEditor: Component<KeyEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(props.label);
  const [editing, setEditing] = createSignal(false);

  createEffect(() => {
    if (!editing()) setDraft(props.label);
  });

  // Enter rename mode when the parent requests auto-edit (new property).
  createEffect(() => {
    if (!props.autoEdit || editing()) return;
    setDraft(props.label);
    setEditing(true);
    props.onAutoEditStart?.();
  });

  const commit = () => {
    // Capture draft *before* leaving edit mode. `setEditing(false)` re-runs the
    // label-sync effect above, which would reset draft to `props.label`.
    const next = draft().trim();
    setEditing(false);
    if (next && next !== props.label) {
      props.onRename(next);
    } else {
      setDraft(props.label);
    }
  };

  const cancel = () => {
    setDraft(props.label);
    setEditing(false);
  };

  return (
    <Show
      when={editing()}
      fallback={
        <button
          type="button"
          class="json-tree-key json-tree-key--editable"
          part="key"
          title="Click to rename key"
          onClick={() => {
            setDraft(props.label);
            setEditing(true);
          }}
        >
          <HighlightText
            text={props.label}
            query={props.highlightQuery ?? ''}
            active={props.activeHighlight}
          />
        </button>
      }
    >
      <input
        class="json-tree-key-input"
        part="input"
        type="text"
        value={draft()}
        aria-label="Property key"
        ref={(el) => {
          queueMicrotask(() => {
            el.focus();
            el.select();
          });
        }}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
    </Show>
  );
};
