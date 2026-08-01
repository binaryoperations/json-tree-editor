import { type Component, For, Show } from 'solid-js';

import {
  addPropertyAtPath,
  addShapedItemAtPath,
  convertJsonType,
  deleteAtPath,
  getAtPath,
  type JsonPath,
  type JsonTypeName,
  jsonTypeOf,
  renameKeyAtPath,
  setAtPath,
  uniqueObjectKey,
} from '../../lib/json-path';
import { KeyEditor } from './KeyEditor';
import { PrimitiveEditor } from './PrimitiveEditor';
import { TypeBadge } from './TypeBadge';
import { TypeSelect } from './TypeSelect';

export type JsonTreeNodeProps = {
  root: () => unknown;
  path: JsonPath;
  /** Display label: "root", object key, or array index. */
  keyLabel: string;
  isRoot?: boolean;
  isExpanded: (path: JsonPath) => boolean;
  onToggle: (path: JsonPath) => void;
  onExpand: (path: JsonPath) => void;
  onCommit: (nextRoot: unknown) => void;
};

export const JsonTreeNode: Component<JsonTreeNodeProps> = (props) => {
  const value = () => getAtPath(props.root(), props.path);
  const typeName = () => jsonTypeOf(value());
  const isContainer = () => {
    const t = typeName();
    return t === 'object' || t === 'array';
  };
  const open = () => props.isExpanded(props.path);

  /**
   * Primitive keys (string | number) so Solid <For> reconciles by value and
   * does not remount row inputs on every keystroke.
   */
  const childKeys = (): (string | number)[] => {
    const v = value();
    if (Array.isArray(v)) {
      return v.map((_, i) => i);
    }
    if (v !== null && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>);
    }
    return [];
  };

  const summary = () => {
    const v = value();
    if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
    if (v !== null && typeof v === 'object') {
      const n = Object.keys(v as object).length;
      return `${n} key${n === 1 ? '' : 's'}`;
    }
    return '';
  };

  const setValue = (next: unknown) => {
    props.onCommit(setAtPath(props.root(), props.path, next));
  };

  const changeType = (to: JsonTypeName) => {
    const converted = convertJsonType(value(), to);
    setValue(converted);
    if (to === 'object' || to === 'array') {
      props.onExpand(props.path);
    }
  };

  const remove = () => {
    if (props.isRoot) return;
    props.onCommit(deleteAtPath(props.root(), props.path));
  };

  const addProperty = () => {
    const v = value();
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return;
    const key = uniqueObjectKey(v as Record<string, unknown>);
    props.onCommit(addPropertyAtPath(props.root(), props.path, key, null));
    props.onExpand(props.path);
  };

  const addItem = () => {
    if (!Array.isArray(value())) return;
    // Clone shape of last element (empty leaves); empty array → null.
    props.onCommit(addShapedItemAtPath(props.root(), props.path));
    props.onExpand(props.path);
  };

  const renameKey = (newKey: string) => {
    if (props.isRoot || props.path.length === 0) return;
    const last = props.path[props.path.length - 1];
    if (typeof last !== 'string') return;
    const parentPath = props.path.slice(0, -1);
    props.onCommit(renameKeyAtPath(props.root(), parentPath, last, newKey));
  };

  const isArrayIndex = () =>
    !props.isRoot &&
    props.path.length > 0 &&
    typeof props.path[props.path.length - 1] === 'number';

  return (
    <div
      class="json-tree-node"
      classList={{ 'json-tree-node--root': !!props.isRoot }}
      role="treeitem"
      aria-expanded={isContainer() ? open() : undefined}
    >
      <div class="json-tree-row">
        <Show
          when={isContainer()}
          fallback={<span class="json-tree-chevron json-tree-chevron--leaf" />}
        >
          <button
            type="button"
            class="json-tree-chevron"
            classList={{ 'json-tree-chevron--open': open() }}
            aria-label={open() ? 'Collapse' : 'Expand'}
            onClick={() => props.onToggle(props.path)}
          >
            ▶
          </button>
        </Show>

        <Show
          when={!props.isRoot && !isArrayIndex()}
          fallback={
            <span
              class="json-tree-key"
              classList={{
                'json-tree-key--root': !!props.isRoot,
                'json-tree-key--index': isArrayIndex(),
              }}
            >
              {props.keyLabel}
            </span>
          }
        >
          <KeyEditor label={props.keyLabel} onRename={renameKey} />
        </Show>

        <TypeBadge type={typeName()} />

        <Show when={isContainer()}>
          <span class="json-tree-summary">{summary()}</span>
        </Show>

        <Show when={!isContainer()}>
          <PrimitiveEditor value={value()} onCommit={setValue} />
        </Show>

        <TypeSelect type={typeName()} onChange={changeType} />

        <div class="json-tree-actions">
          <Show when={typeName() === 'object'}>
            <button
              type="button"
              class="json-tree-action"
              title="Add property"
              onClick={addProperty}
            >
              + key
            </button>
          </Show>
          <Show when={typeName() === 'array'}>
            <button
              type="button"
              class="json-tree-action"
              title="Add item"
              onClick={addItem}
            >
              + item
            </button>
          </Show>
          <Show when={!props.isRoot}>
            <button
              type="button"
              class="json-tree-action json-tree-action--danger"
              title="Delete"
              onClick={remove}
            >
              ×
            </button>
          </Show>
        </div>
      </div>

      <Show when={isContainer() && open()}>
        <div class="json-tree-children" role="group">
          <For each={childKeys()}>
            {(key) => (
              <JsonTreeNode
                root={props.root}
                path={[...props.path, key]}
                keyLabel={String(key)}
                isExpanded={props.isExpanded}
                onToggle={props.onToggle}
                onExpand={props.onExpand}
                onCommit={props.onCommit}
              />
            )}
          </For>
          <Show when={childKeys().length === 0}>
            <div class="json-tree-empty">
              {typeName() === 'array' ? 'Empty array' : 'Empty object'}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
