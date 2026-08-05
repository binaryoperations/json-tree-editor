import { type Component, Show } from 'solid-js';

import { dateToJsonString, jsonTypeOf } from '../../lib/json-path';
import { NullEditor } from './NullEditor';
import { NumberEditor } from './NumberEditor';
import { StringEditor } from './StringEditor';

export type PrimitiveEditorProps = {
  value: unknown;
  onCommit: (next: unknown) => void;
};

/** Display/edit value for string rows — coerce live `Date` to ISO. */
function asStringValue(value: unknown): string {
  if (value instanceof Date) return dateToJsonString(value);
  return typeof value === 'string' ? value : String(value ?? '');
}

export const PrimitiveEditor: Component<PrimitiveEditorProps> = (props) => {
  const kind = () => jsonTypeOf(props.value);

  return (
    <span class="json-tree-value" part="value">
      <Show when={kind() === 'string'}>
        <StringEditor
          value={asStringValue(props.value)}
          onCommit={(next) => {
            // Always store plain string (never leave a Date instance in the tree).
            props.onCommit(next);
          }}
        />
      </Show>

      <Show when={kind() === 'number'}>
        <NumberEditor value={props.value as number} onCommit={props.onCommit} />
      </Show>

      <Show when={kind() === 'boolean'}>
        <select
          class="json-tree-input json-tree-input--boolean"
          part="input"
          value={String(props.value)}
          aria-label="Boolean value"
          onChange={(e) => props.onCommit(e.currentTarget.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </Show>

      <Show when={kind() === 'null'}>
        <NullEditor onCommit={props.onCommit} />
      </Show>
    </span>
  );
};
