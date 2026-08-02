import { type Component, createSignal, For, Show } from 'solid-js';

import {
  addShapedItemAtPath,
  addShapedPropertyAtPath,
  convertJsonType,
  DEFAULT_OBJECT_KEY,
  deleteAtPath,
  duplicateAtPath,
  duplicateKeyAtPath,
  getAtPath,
  type JsonPath,
  type JsonTypeName,
  jsonTypeOf,
  pathDomId,
  pathKey,
  renameKeyAtPath,
  setAtPath,
  uniqueObjectKey,
} from '../../lib/json-path';
import { KeyEditor } from './KeyEditor';
import { PrimitiveEditor } from './PrimitiveEditor';
import { ROOT_JSON_TYPES, TypeSelect } from './TypeSelect';

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
  /** Path key of the roving-tabindex active row. */
  focusedPathKey: () => string;
  onFocusPath: (path: JsonPath) => void;
  /** When true, this row's key editor opens in rename mode on mount. */
  autoEditKey?: boolean;
  onAutoEditKeyStart?: () => void;
  /**
   * Ask the parent object node to open rename on a newly created key
   * (e.g. after duplicating a property).
   */
  onRequestEditKey?: (key: string) => void;
};

export const JsonTreeNode: Component<JsonTreeNodeProps> = (props) => {
  const value = () => getAtPath(props.root(), props.path);
  const typeName = () => jsonTypeOf(value());
  const isContainer = () => {
    const t = typeName();
    return t === 'object' || t === 'array';
  };
  const open = () => props.isExpanded(props.path);
  /** Child object key that should open in rename mode (after +key / type→object). */
  const [pendingEditKey, setPendingEditKey] = createSignal<string | null>(null);

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
    // Document root may only be object or array — never a primitive.
    if (props.isRoot && to !== 'object' && to !== 'array') return;
    const prevType = typeName();
    const converted = convertJsonType(value(), to);
    setValue(converted);
    if (to === 'object' || to === 'array') {
      props.onExpand(props.path);
    }
    // Fresh object (not already an object) seeds one key — open it for rename.
    if (to === 'object' && prevType !== 'object') {
      setPendingEditKey(DEFAULT_OBJECT_KEY);
    }
  };

  const remove = () => {
    if (props.isRoot) return;
    props.onCommit(deleteAtPath(props.root(), props.path));
  };

  const emptyContainer = () => {
    const t = typeName();
    if (t === 'object') {
      setValue({});
      return;
    }
    if (t === 'array') {
      setValue([]);
    }
  };

  const addProperty = () => {
    const v = value();
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return;
    // Clone shape of last property (or first when only one); empty → null.
    const key = uniqueObjectKey(v as Record<string, unknown>);
    props.onCommit(addShapedPropertyAtPath(props.root(), props.path, key));
    props.onExpand(props.path);
    setPendingEditKey(key);
  };

  const addItem = () => {
    if (!Array.isArray(value())) return;
    // Clone shape of last element (or first when only one); empty → null.
    props.onCommit(addShapedItemAtPath(props.root(), props.path));
    props.onExpand(props.path);
  };

  /** Duplicate this entire object/array as the next sibling (not root / not primitives). */
  const duplicateSelf = () => {
    if (props.isRoot || props.path.length === 0) return;
    if (!isContainer()) return;
    const newKey = duplicateKeyAtPath(props.root(), props.path);
    props.onCommit(duplicateAtPath(props.root(), props.path));
    if (newKey != null) {
      props.onRequestEditKey?.(newKey);
    }
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

  const tabIndex = () =>
    pathKey(props.path) === props.focusedPathKey() ? 0 : -1;

  const focusRow = () => {
    props.onFocusPath(props.path);
  };

  /** Focus the treeitem when clicking non-editable parts of the row. */
  const onRowMouseDown = (e: MouseEvent) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('button, input, select, textarea, a, label')) return;
    // Defer so we don't fight focus moves into nested controls.
    const item = (e.currentTarget as HTMLElement).closest(
      '[role="treeitem"]',
    ) as HTMLElement | null;
    if (!item) return;
    focusRow();
    // Focus the treeitem itself for arrow-key navigation.
    queueMicrotask(() => item.focus({ preventScroll: true }));
  };

  const onTreeItemFocusIn = (e: FocusEvent) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    // Only adopt focus for this row, not bubbled events from nested treeitems.
    const nearest = t.closest('[role="treeitem"]');
    if (nearest !== e.currentTarget) return;
    focusRow();
  };

  return (
    <div
      class="json-tree-node"
      classList={{ 'json-tree-node--root': !!props.isRoot }}
      role="treeitem"
      aria-expanded={isContainer() ? open() : undefined}
      data-path={pathDomId(props.path)}
      tabIndex={tabIndex()}
      onFocusIn={onTreeItemFocusIn}
    >
      <div class="json-tree-row" part="row" onMouseDown={onRowMouseDown}>
        <Show
          when={isContainer()}
          fallback={
            <span
              class="json-tree-chevron json-tree-chevron--leaf"
              part="chevron"
            />
          }
        >
          <button
            type="button"
            class="json-tree-chevron"
            part="chevron"
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
              part="key"
              classList={{
                'json-tree-key--root': !!props.isRoot,
                'json-tree-key--index': isArrayIndex(),
              }}
            >
              {props.keyLabel}
            </span>
          }
        >
          <KeyEditor
            label={props.keyLabel}
            onRename={renameKey}
            autoEdit={props.autoEditKey}
            onAutoEditStart={props.onAutoEditKeyStart}
          />
        </Show>

        {/* Badge-styled type select (no separate type label node). */}
        <TypeSelect
          type={typeName()}
          onChange={changeType}
          allowedTypes={props.isRoot ? ROOT_JSON_TYPES : undefined}
        />

        <Show when={isContainer()}>
          <span class="json-tree-summary" part="summary">
            {summary()}
          </span>
        </Show>

        <Show when={!isContainer()}>
          <PrimitiveEditor value={value()} onCommit={setValue} />
        </Show>

        <div class="json-tree-actions" part="actions">
          <Show when={!props.isRoot && isContainer()}>
            <button
              type="button"
              class="json-tree-action"
              part="action"
              title="Duplicate"
              onClick={duplicateSelf}
            >
              duplicate
            </button>
          </Show>
          <Show when={!props.isRoot}>
            <button
              type="button"
              class="json-tree-action json-tree-action--danger"
              part="action"
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
          {/* + add then empty as the first row inside the container */}
          <div class="json-tree-add-row" part="add-row">
            <span
              class="json-tree-chevron json-tree-chevron--leaf"
              part="chevron"
              aria-hidden="true"
            />
            <Show when={typeName() === 'object'}>
              <button
                type="button"
                class="json-tree-add-row__btn"
                part="action"
                title="Add property"
                onClick={addProperty}
              >
                + key
              </button>
            </Show>
            <Show when={typeName() === 'array'}>
              <button
                type="button"
                class="json-tree-add-row__btn"
                part="action"
                title="Add item"
                onClick={addItem}
              >
                + item
              </button>
            </Show>
            <button
              type="button"
              class="json-tree-add-row__btn json-tree-add-row__btn--danger"
              part="action"
              title={
                typeName() === 'array' ? 'Clear array' : 'Clear object'
              }
              disabled={childKeys().length === 0}
              onClick={emptyContainer}
            >
              clear
            </button>
          </div>

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
                focusedPathKey={props.focusedPathKey}
                onFocusPath={props.onFocusPath}
                autoEditKey={
                  typeof key === 'string' && pendingEditKey() === key
                }
                onAutoEditKeyStart={() => setPendingEditKey(null)}
                onRequestEditKey={
                  typeName() === 'object'
                    ? (k) => setPendingEditKey(k)
                    : undefined
                }
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
