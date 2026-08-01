import { type Component } from 'solid-js';

import type { JsonTypeName } from '../../lib/json-path';

export type TypeSelectProps = {
  type: JsonTypeName;
  onChange: (t: JsonTypeName) => void;
};

export const TypeSelect: Component<TypeSelectProps> = (props) => (
  <select
    class="json-tree-type-select"
    title="Change type"
    value={props.type}
    onChange={(e) => {
      props.onChange(e.currentTarget.value as JsonTypeName);
    }}
  >
    <option value="string">string</option>
    <option value="number">number</option>
    <option value="boolean">boolean</option>
    <option value="null">null</option>
    <option value="object">object</option>
    <option value="array">array</option>
  </select>
);
