import { type Component, createSignal, Show } from 'solid-js';

import { parseNullEditorDraft } from '../../lib/json-path';

export type NullEditorProps = {
  onCommit: (next: unknown) => void;
};

/**
 * Editable `null` leaf: focus/click opens an input. On commit the draft is
 * typed via {@link parseNullEditorDraft} (JSON when possible, else number or string).
 * Empty draft keeps `null`.
 */
export const NullEditor: Component<NullEditorProps> = (props) => {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal('');

  const open = () => {
    setDraft('');
    setEditing(true);
  };

  const commit = () => {
    // Read draft before leaving edit mode (same pattern as KeyEditor).
    const text = draft();
    setEditing(false);
    setDraft('');
    props.onCommit(parseNullEditorDraft(text));
  };

  const cancel = () => {
    setDraft('');
    setEditing(false);
  };

  return (
    <Show
      when={editing()}
      fallback={
        <button
          type="button"
          class="json-tree-null json-tree-null--editable"
          part="null"
          title="Edit null value"
          aria-label="Null value, click or focus to edit"
          onFocus={open}
          onClick={open}
        >
          null
        </button>
      }
    >
      <input
        class="json-tree-input json-tree-input--null"
        part="input"
        type="text"
        value={draft()}
        aria-label="Null value editor"
        placeholder="null"
        ref={(el) => {
          queueMicrotask(() => {
            el.focus();
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
