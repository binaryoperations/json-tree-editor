import { type Component, For, Show } from 'solid-js';

import { splitHighlightSegments } from '../../lib/search';

export type HighlightTextProps = {
  text: string;
  /** Debounced search query; empty → plain text. */
  query: string;
  /** Stronger mark styling for the active match. */
  active?: boolean;
};

/**
 * Renders `text` with case-insensitive substring matches wrapped in `<mark>`.
 */
export const HighlightText: Component<HighlightTextProps> = (props) => {
  const segments = () => splitHighlightSegments(props.text, props.query);

  return (
    <Show
      when={props.query.trim().length > 0}
      fallback={<>{props.text}</>}
    >
      <For each={segments()}>
        {(seg) => (
          <Show when={seg.match} fallback={<>{seg.text}</>}>
            <mark
              class="json-tree-mark"
              classList={{ 'json-tree-mark--active': !!props.active }}
              part="mark"
            >
              {seg.text}
            </mark>
          </Show>
        )}
      </For>
    </Show>
  );
};
