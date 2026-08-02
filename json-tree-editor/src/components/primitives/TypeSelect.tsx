import { type Component, For } from 'solid-js';

import type { JsonTypeName } from '../../lib/json-path';

/** Types allowed at the document root (object or array only). */
export const ROOT_JSON_TYPES: readonly JsonTypeName[] = ['object', 'array'];

/** All JSON types available for non-root nodes. */
export const ALL_JSON_TYPES: readonly JsonTypeName[] = [
  'string',
  'number',
  'boolean',
  'null',
  'object',
  'array',
];

export type TypeSelectProps = {
  type: JsonTypeName;
  onChange: (t: JsonTypeName) => void;
  /**
   * Allowed type options. Defaults to all JSON types.
   * Pass {@link ROOT_JSON_TYPES} for the document root.
   */
  allowedTypes?: readonly JsonTypeName[];
};

export const TypeSelect: Component<TypeSelectProps> = (props) => {
  const options = () => props.allowedTypes ?? ALL_JSON_TYPES;

  return (
    <select
      class="json-tree-type-select"
      part="type-select"
      title="Change type"
      value={props.type}
      onChange={(e) => {
        props.onChange(e.currentTarget.value as JsonTypeName);
      }}
    >
      <For each={[...options()]}>
        {(t) => <option value={t}>{t}</option>}
      </For>
    </select>
  );
};
