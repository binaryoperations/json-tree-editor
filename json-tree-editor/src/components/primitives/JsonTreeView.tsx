import {
  type Component,
  createEffect,
  createSignal,
  Show,
} from 'solid-js';

import {
  collectVisiblePaths,
  defaultExpandedPaths,
  getAtPath,
  type JsonPath,
  pathDomId,
  pathKey,
  ROOT_PATH_KEY,
} from '../../lib/json-path';
import {
  EMPTY_ROOT,
  type JsonRootValue,
  type JsonValidity,
} from '../../lib/parse-json';
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
  // No trailing whitespace / newline — keep source clean for hosts that round-trip.
  onChange(JSON.stringify(value, null, 2));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  return target.isContentEditable;
}

function isContainerValue(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

/**
 * Interactive collapsible JSON tree. Edits flow back as pretty-printed source.
 *
 * Always keeps a tree on screen:
 * - Valid document (including blank source → `{}`) → live root.
 * - Primitive root → error banner + normalized empty object `{}`.
 * - Syntax errors → error banner + previous valid tree (or `{}` if none yet).
 *
 * Expand state can be uncontrolled (default) or controlled via
 * `expanded` + `onExpandedChange` for expand-all / collapse-all toolbars.
 *
 * Keyboard (ARIA tree-style, when focus is not in an input/select/textarea):
 * ArrowUp/Down move among visible rows; ArrowRight expands or enters a child;
 * ArrowLeft collapses or moves to the parent; Home/End jump to first/last row.
 */
export const JsonTreeView: Component<JsonTreeViewProps> = (props) => {
  const [internalExpanded, setInternalExpanded] = createSignal<Set<string>>(
    props.defaultExpanded ?? defaultExpandedPaths(),
  );
  /** Roving tabindex: which visible row is the active treeitem. */
  const [focusedPathKey, setFocusedPathKey] =
    createSignal<string>(ROOT_PATH_KEY);
  /**
   * Last successfully parsed root. Used when the source has a syntax error so
   * the tree stays visible while the user fixes the document.
   */
  const [lastGoodRoot, setLastGoodRoot] = createSignal<JsonRootValue | null>(
    null,
  );

  let treeScrollEl: HTMLDivElement | undefined;

  createEffect(() => {
    const v = props.validity;
    if (v.ok) {
      setLastGoodRoot(v.value);
    }
  });

  /**
   * Root shown in the tree:
   * 1. Live valid value
   * 2. Parser fallback (`{}` for empty / invalid-root)
   * 3. Previous valid tree (syntax errors)
   * 4. Empty object as last resort
   */
  const displayRoot = (): JsonRootValue => {
    const v = props.validity;
    if (v.ok) return v.value;
    if (v.value !== undefined) return v.value;
    return lastGoodRoot() ?? EMPTY_ROOT;
  };

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

  const collapsePath = (path: JsonPath) => {
    const prev = expanded();
    const k = pathKey(path);
    if (!prev.has(k)) return;
    const next = new Set(prev);
    next.delete(k);
    applyExpanded(next);
  };

  const commit = (nextRoot: unknown) => {
    emitPretty(nextRoot, props.onChange);
  };

  const findTreeItem = (path: JsonPath): HTMLElement | null => {
    const el = treeScrollEl;
    if (!el) return null;
    const id = pathDomId(path);
    const items = el.querySelectorAll<HTMLElement>('[data-path]');
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].getAttribute('data-path') === id) return items[i];
    }
    return null;
  };

  const focusPath = (path: JsonPath) => {
    setFocusedPathKey(pathKey(path));
    const tryFocus = (): boolean => {
      const item = findTreeItem(path);
      if (!item) return false;
      if (document.activeElement !== item) {
        item.focus({ preventScroll: true });
      }
      item.scrollIntoView({ block: 'nearest' });
      return true;
    };
    if (!tryFocus()) {
      requestAnimationFrame(() => {
        if (!tryFocus()) requestAnimationFrame(() => {
          tryFocus();
        });
      });
    }
  };

  const onFocusPath = (path: JsonPath) => {
    setFocusedPathKey(pathKey(path));
  };

  const pathFromEventTarget = (target: EventTarget | null): JsonPath | null => {
    if (!(target instanceof Element)) return null;
    const item = target.closest('[data-path]');
    if (!(item instanceof HTMLElement)) return null;
    const raw = item.getAttribute('data-path');
    if (raw == null) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed as JsonPath;
    } catch {
      return null;
    }
  };

  const onTreeKeyDown = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;

    const key = e.key;
    if (
      key !== 'ArrowDown' &&
      key !== 'ArrowUp' &&
      key !== 'ArrowRight' &&
      key !== 'ArrowLeft' &&
      key !== 'Home' &&
      key !== 'End'
    ) {
      return;
    }

    const root = displayRoot();
    const visible = collectVisiblePaths(root, expanded());
    if (visible.length === 0) return;

    const currentPath =
      pathFromEventTarget(e.target) ??
      (() => {
        const k = focusedPathKey();
        return visible.find((p) => pathKey(p) === k) ?? visible[0];
      })();
    const currentKey = pathKey(currentPath);
    let index = visible.findIndex((p) => pathKey(p) === currentKey);
    if (index < 0) index = 0;

    e.preventDefault();
    e.stopPropagation();

    if (key === 'ArrowDown') {
      if (index < visible.length - 1) focusPath(visible[index + 1]);
      return;
    }
    if (key === 'ArrowUp') {
      if (index > 0) focusPath(visible[index - 1]);
      return;
    }
    if (key === 'Home') {
      focusPath(visible[0]);
      return;
    }
    if (key === 'End') {
      focusPath(visible[visible.length - 1]);
      return;
    }

    const value = getAtPath(root, currentPath);
    const container = isContainerValue(value);
    const open = expanded().has(currentKey);

    if (key === 'ArrowRight') {
      if (container && !open) {
        expandPath(currentPath);
        return;
      }
      if (container && open && index < visible.length - 1) {
        const next = visible[index + 1];
        // First child is the next visible row when expanded.
        if (next.length === currentPath.length + 1) {
          focusPath(next);
        }
      }
      return;
    }

    // ArrowLeft
    if (container && open) {
      collapsePath(currentPath);
      return;
    }
    if (currentPath.length > 0) {
      focusPath(currentPath.slice(0, -1));
    }
  };

  const errorMessage = () =>
    props.validity.ok ? null : props.validity.error;

  const errorHint = () => {
    const v = props.validity;
    if (v.ok) return null;
    if (v.reason === 'invalid-root') {
      return 'Showing empty object. Change the root type below or fix the source.';
    }
    return lastGoodRoot()
      ? 'Showing the last valid tree. Fix JSON syntax in the source editor.'
      : 'Showing empty object. Fix JSON syntax in the source editor.';
  };

  return (
    <div class="json-tree" part="tree">
      <Show when={errorMessage()}>
        {(msg) => (
          <div class="json-tree__error" part="error" role="status">
            <strong>Invalid JSON</strong>
            <p>{msg()}</p>
            <Show when={errorHint()}>
              {(hint) => <p class="json-tree__hint">{hint()}</p>}
            </Show>
          </div>
        )}
      </Show>

      <div
        class="json-tree__scroll"
        part="scroll"
        role="tree"
        aria-label="JSON tree"
        ref={(el) => {
          treeScrollEl = el;
        }}
        onKeyDown={onTreeKeyDown}
      >
        <JsonTreeNode
          root={displayRoot}
          path={[]}
          keyLabel="root"
          isRoot
          isExpanded={isExpanded}
          onToggle={toggle}
          onExpand={expandPath}
          onCommit={commit}
          focusedPathKey={focusedPathKey}
          onFocusPath={onFocusPath}
        />
      </div>
    </div>
  );
};
