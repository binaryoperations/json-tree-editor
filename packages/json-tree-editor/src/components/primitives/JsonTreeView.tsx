import { type Component, createSignal, Show } from 'solid-js';

import {
  defaultExpandedPaths,
  type JsonPath,
  pathKey,
} from '../../lib/json-path';
import type { JsonValidity } from '../../lib/parse-json';
import { JsonTreeNode } from './JsonTreeNode';

export type JsonTreeViewProps = {
  validity: JsonValidity;
  /** Called with pretty-printed JSON (2-space indent) after a tree edit. */
  onChange: (prettyJson: string) => void;
  /**
   * Controlled expanded path keys (`pathKey` / `ROOT_PATH_KEY`).
   * When set, the parent owns expand state and should update via `onExpandedChange`.
   */
  expanded?: Set<string>;
  /**
   * Notified whenever expand state changes (chevron toggle, expand after add,
   * or parent-driven expand/collapse-all).
   */
  onExpandedChange?: (next: Set<string>) => void;
  /**
   * Uncontrolled initial expanded set (default: root only).
   * Ignored when `expanded` is provided.
   */
  defaultExpanded?: Set<string>;
};

function emitPretty(value: unknown, onChange: (s: string) => void): void {
  onChange(JSON.stringify(value, null, 2) + '\n');
}

/**
 * Interactive collapsible JSON tree. Edits flow back as pretty-printed source.
 * Disabled when validity is not ok so users can fix syntax in the source pane.
 *
 * Expand state can be uncontrolled (default) or controlled via
 * `expanded` + `onExpandedChange` for expand-all / collapse-all toolbars.
 */
export const JsonTreeView: Component<JsonTreeViewProps> = (props) => {
  const [internalExpanded, setInternalExpanded] = createSignal<Set<string>>(
    props.defaultExpanded ?? defaultExpandedPaths(),
  );

  const isControlled = () => props.expanded !== undefined;

  const expanded = (): Set<string> =>
    isControlled() ? props.expanded! : internalExpanded();

  const applyExpanded = (next: Set<string>) => {
    if (!isControlled()) {
      setInternalExpanded(next);
    }
    props.onExpandedChange?.(next);
  };

  const isExpanded = (path: JsonPath) => expanded().has(pathKey(path));

  const toggle = (path: JsonPath) => {
    const prev = expanded();
    const next = new Set(prev);
    const k = pathKey(path);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    applyExpanded(next);
  };

  /** Ensure containers expand after adding children. */
  const expandPath = (path: JsonPath) => {
    const prev = expanded();
    const k = pathKey(path);
    if (prev.has(k)) return;
    const next = new Set(prev);
    next.add(k);
    applyExpanded(next);
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
