import { type Component, Show } from 'solid-js';

import { jsonTypeOf } from '../../lib/json-path';
import { NumberEditor } from './NumberEditor';
import { StringEditor } from './StringEditor';

export type PrimitiveEditorProps = {
  value: unknown;
  onCommit: (next: unknown) => void;
};

export const PrimitiveEditor: Component<PrimitiveEditorProps> = (props) => {
  const kind = () => jsonTypeOf(props.value);

  return (
    <span class="json-tree-value">
      <Show when={kind() === 'string'}>
        <StringEditor value={props.value as string} onCommit={props.onCommit} />
      </Show>

      <Show when={kind() === 'number'}>
        <NumberEditor value={props.value as number} onCommit={props.onCommit} />
      </Show>

      <Show when={kind() === 'boolean'}>
        <select
          class="json-tree-input json-tree-input--boolean"
          value={String(props.value)}
          aria-label="Boolean value"
          onChange={(e) => props.onCommit(e.currentTarget.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </Show>

      <Show when={kind() === 'null'}>
        <span class="json-tree-null">null</span>
      </Show>
    </span>
  );
};
