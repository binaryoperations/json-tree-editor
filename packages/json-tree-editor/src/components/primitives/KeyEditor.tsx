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
    setEditing(false);
    const next = draft().trim();
    if (next && next !== props.label) {
      props.onRename(next);
    } else {
      setDraft(props.label);
    }
  };

  return (
    <Show
      when={editing()}
      fallback={
        <button
          type="button"
          class="json-tree-key json-tree-key--editable"
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
            setDraft(props.label);
            setEditing(false);
          }
        }}
      />
    </Show>
  );
};
