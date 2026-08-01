import { type Component, createEffect, createSignal } from 'solid-js';

export type StringEditorProps = {
  value: string;
  onCommit: (next: string) => void;
};

/** Local draft while focused so live source sync does not reset the caret. */
export const StringEditor: Component<StringEditorProps> = (props) => {
  const [draft, setDraft] = createSignal(props.value);
  const [focused, setFocused] = createSignal(false);

  createEffect(() => {
    const v = props.value;
    if (!focused()) setDraft(v);
  });

  return (
    <input
      class="json-tree-input json-tree-input--string"
      part="input"
      type="text"
      value={draft()}
      aria-label="String value"
      onFocus={() => setFocused(true)}
      onInput={(e) => {
        const next = e.currentTarget.value;
        setDraft(next);
        props.onCommit(next);
      }}
      onBlur={() => setFocused(false)}
    />
  );
};
