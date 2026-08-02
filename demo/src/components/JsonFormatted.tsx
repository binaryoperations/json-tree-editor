import type { JsonValidity } from '../../../json-tree-editor/src/utils';
import { type Component, Show } from 'solid-js';

export type JsonFormattedProps = {
  validity: JsonValidity;
};

/**
 * Read-only pretty-printed JSON when valid; error message when invalid.
 */
export const JsonFormatted: Component<JsonFormattedProps> = (props) => {
  return (
    <div class="json-formatted">
      <Show
        when={props.validity.ok ? props.validity.pretty : false}
        fallback={
          <div class="json-formatted__error" role="status">
            <strong>Invalid JSON</strong>
            <p>{props.validity.ok ? '' : props.validity.error}</p>
          </div>
        }
      >
        {(pretty) => (
          <pre class="json-formatted__pre">
            <code>{pretty()}</code>
          </pre>
        )}
      </Show>
    </div>
  );
};
