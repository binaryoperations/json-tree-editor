import { type Component } from 'solid-js';

import type { JsonTypeName } from '../../lib/json-path';

export type TypeBadgeProps = {
  type: JsonTypeName;
};

export const TypeBadge: Component<TypeBadgeProps> = (props) => (
  <span
    class="json-tree-type"
    classList={{ [`json-tree-type--${props.type}`]: true }}
  >
    {props.type}
  </span>
);
