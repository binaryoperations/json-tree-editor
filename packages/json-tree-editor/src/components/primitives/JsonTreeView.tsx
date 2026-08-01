import { type Component, createSignal, Show } from 'solid-js';

import { type JsonPath, pathKey } from '../../lib/json-path';
import type { JsonValidity } from '../../lib/parse-json';
import { JsonTreeNode } from './JsonTreeNode';

export type JsonTreeViewProps = {
  validity: JsonValidity;
  /** Called with pretty-printed JSON (2-space indent) after a tree edit. */
  onChange: (prettyJson: string) => void;
};

function emitPretty(value: unknown, onChange: (s: string) => void): void {
  onChange(JSON.stringify(value, null, 2) + '\n');
}

/**
 * Interactive collapsible JSON tree. Edits flow back as pretty-printed source.
 * Disabled when validity is not ok so users can fix syntax in the source pane.
 */
export const JsonTreeView: Component<JsonTreeViewProps> = (props) => {
  /** Paths that are expanded. Root (`''`) starts open. */
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set(['']));

  const isExpanded = (path: JsonPath) => expanded().has(pathKey(path));

  const toggle = (path: JsonPath) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const k = pathKey(path);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  /** Ensure containers expand after adding children. */
  const expandPath = (path: JsonPath) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(pathKey(path));
      return next;
    });
  };

  const commit = (nextRoot: unknown) => {
    emitPretty(nextRoot, props.onChange);
  };

  return (
    <div class="json-tree">
      <Show
        when={props.validity.ok}
        fallback={
          <div class="json-tree__disabled" role="status">
            <strong>Tree unavailable</strong>
            <p>{props.validity.ok ? '' : props.validity.error}</p>
            <p class="json-tree__hint">
              Fix JSON syntax in the source editor to enable the tree.
            </p>
          </div>
        }
      >
        <div class="json-tree__scroll" role="tree" aria-label="JSON tree">
          <JsonTreeNode
            root={() =>
              (props.validity as Extract<JsonValidity, { ok: true }>).value
            }
            path={[]}
            keyLabel="root"
            isRoot
            isExpanded={isExpanded}
            onToggle={toggle}
            onExpand={expandPath}
            onCommit={commit}
          />
        </div>
      </Show>
    </div>
  );
};
