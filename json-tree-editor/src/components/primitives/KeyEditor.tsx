import { type Component, createEffect, createSignal, Show } from 'solid-js';

export type KeyEditorProps = {
  label: string;
  onRename: (newKey: string) => void;
};

export const KeyEditor: Component<KeyEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(props.label);
  const [editing, setEditing] = createSignal(false);

  createEffect(() => {
    if (!editing()) setDraft(props.label);
  });

  const commit = () => {
    // Capture draft *before* leaving edit mode. `setEditing(false)` re-runs the
    // effect above, which resets draft to `props.label` and would drop the rename.
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
          {props.label}
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
          queueMicrotask(() => el.focus());
          el.select();
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
