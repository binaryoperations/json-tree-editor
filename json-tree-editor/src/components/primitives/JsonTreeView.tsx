import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';

import {
  collectChildContainerPathKeys,
  collectContainerPathKeys,
  collectVisiblePaths,
  defaultExpandedPaths,
  expandedPathsUpToDepth,
  getAtPath,
  type JsonPath,
  pathDomId,
  pathKey,
  ROOT_PATH_KEY,
} from '../../lib/json-path';
import {
  EMPTY_ROOT,
  type JsonRootValue,
  parseJsonSource,
  stringifyJsonDocument,
} from '../../lib/parse-json';
import {
  type ArrayReorderController,
  resolveArrayReorderController,
} from './array-reorder';
import { JsonTreeNode } from './JsonTreeNode';

/** Progress of a chunked {@link JsonTreeViewHandle.expandAll}. */
export type ExpandProgress = { done: number; total: number };

/** Imperative handle exposed via Solid `ref` on {@link JsonTreeView}. */
export type JsonTreeViewHandle = {
  expandAll: () => void;
  collapseAll: () => void;
  isExpanding: () => boolean;
  /** The root `.json-tree` DOM element (or `null` before mount). */
  getRoot: () => HTMLDivElement | null;
};

export type JsonTreeViewProps = {
  /** JSON document source (parsed internally). */
  value: string;
  /** Called with pretty-printed JSON (2-space indent) after a tree edit. */
  onChange: (prettyJson: string) => void;
  /**
   * How many nesting levels start expanded.
   * - `0` (default) — root container open only
   * - `1` — root + each direct child container
   * - `n` — all containers at path depth ≤ `n`
   *
   * Applied on mount from the initial document (not path keys — hosts never
   * need internal expand keys).
   */
  defaultExpandedDepth?: number;
  /**
   * Array sibling reorder strategy.
   * - omit / `undefined` — HTML5 drag-and-drop (default)
   * - `false` — disable reorder entirely
   * - custom {@link ArrayReorderController} — replace parent session + item UI
   *
   * Keep the reference stable for the life of the tree (factories create
   * signals once per node on mount).
   */
  arrayReorder?: ArrayReorderController | false;
  /**
   * Fired once when {@link JsonTreeViewHandle.expandAll} finishes successfully.
   * Receives the full expanded path-key set.
   */
  onExpand?: (expandedKeys: Set<string>) => void;
  /**
   * Fired during chunked expandAll; `null` when idle, finished, or cancelled.
   */
  onExpandProgress?: (progress: ExpandProgress | null) => void;
  /**
   * Fired once when {@link JsonTreeViewHandle.collapseAll} completes.
   * Receives the resulting expand set (root-only).
   */
  onCollapse?: (expandedKeys: Set<string>) => void;
  /** Solid component ref (function form recommended). */
  ref?: JsonTreeViewHandle | ((handle: JsonTreeViewHandle) => void);
};

/**
 * expandAll scheduling:
 * rAF does not make work async — the callback still runs synchronously and
 * blocks input/paint until it returns. So we do at most one applyExpanded per
 * frame (EXPAND_CHUNK keys), then return and schedule the next rAF so the
 * browser can paint and handle events between batches.
 */
const EXPAND_CHUNK = 48;

function emitPretty(value: unknown, onChange: (s: string) => void): void {
  // No trailing whitespace / newline — keep source clean for hosts that round-trip.
  // Throws if any function slipped into the tree (never silently drop them).
  onChange(stringifyJsonDocument(value));
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

function assignRef(
  ref: JsonTreeViewProps['ref'],
  handle: JsonTreeViewHandle,
): void {
  if (typeof ref === 'function') {
    ref(handle);
    return;
  }
  if (ref && typeof ref === 'object') {
    Object.assign(ref, handle);
  }
}

function initialExpandedFromProps(
  value: string,
  depth: number | undefined,
): Set<string> {
  const d = depth ?? 0;
  if (d <= 0) return defaultExpandedPaths();
  const parsed = parseJsonSource(value);
  const root = parsed.ok
    ? parsed.value
    : parsed.value !== undefined
      ? parsed.value
      : EMPTY_ROOT;
  return expandedPathsUpToDepth(root, d);
}

/**
 * Interactive collapsible JSON tree. Pass document source as `value`; the view
 * parses internally and writes pretty JSON back through `onChange`.
 *
 * Expand-all / collapse-all are available on the Solid `ref` handle (chunked
 * rAF expand for large documents). Initial open depth is
 * {@link JsonTreeViewProps.defaultExpandedDepth} (default `0` = root only).
 *
 * Always keeps a tree on screen:
 * - Valid document (including blank source → `{}`) → live root.
 * - Primitive root → error banner + normalized empty object `{}`.
 * - Syntax errors → error banner + previous valid tree (or `{}` if none yet).
 *
 * Keyboard (ARIA tree-style, when focus is not in an input/select/textarea):
 * ArrowUp/Down move among visible rows; ArrowRight expands or enters a child;
 * ArrowLeft collapses or moves to the parent; Home/End jump to first/last row.
 */
export const JsonTreeView: Component<JsonTreeViewProps> = (props) => {
  const [internalExpanded, setInternalExpanded] = createSignal<Set<string>>(
    initialExpandedFromProps(props.value, props.defaultExpandedDepth),
  );
  /** Roving tabindex: which visible row is the active treeitem. */
  const [focusedPathKey, setFocusedPathKey] =
    createSignal<string>(ROOT_PATH_KEY);
  /** Resolved once on mount — keep `arrayReorder` prop stable for the tree life. */
  const arrayReorderController = resolveArrayReorderController(
    props.arrayReorder,
  );
  /**
   * Last successfully parsed root. Used when the source has a syntax error so
   * the tree stays visible while the user fixes the document.
   */
  const [lastGoodRoot, setLastGoodRoot] = createSignal<JsonRootValue | null>(
    null,
  );
  const [expandProgress, setExpandProgress] =
    createSignal<ExpandProgress | null>(null);

  /** Bumps to cancel an in-flight expand-all. */
  let expandGeneration = 0;

  let treeRootEl: HTMLDivElement | undefined;
  let treeScrollEl: HTMLDivElement | undefined;

  const validity = createMemo(() => parseJsonSource(props.value));

  createEffect(() => {
    const v = validity();
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
    const v = validity();
    if (v.ok) return v.value;
    if (v.value !== undefined) return v.value;
    return lastGoodRoot() ?? EMPTY_ROOT;
  };

  const expanded = (): Set<string> => internalExpanded();

  const applyExpanded = (next: Set<string>) => {
    setInternalExpanded(next);
  };

  const reportProgress = (progress: ExpandProgress | null) => {
    setExpandProgress(progress);
    props.onExpandProgress?.(progress);
  };

  const cancelExpandAll = () => {
    expandGeneration += 1;
    if (expandProgress() !== null) {
      reportProgress(null);
    }
  };

  const collapseAll = () => {
    cancelExpandAll();
    const next = defaultExpandedPaths();
    applyExpanded(next);
    props.onCollapse?.(next);
  };

  /**
   * Expand every object/array in DFS order. One Solid apply per animation
   * frame, then yield — rAF only defers the next turn; it does not unblock
   * work already running inside the callback.
   */
  const expandAll = () => {
    cancelExpandAll();

    const keys = collectContainerPathKeys(displayRoot());
    const total = keys.length;
    if (total === 0) {
      const empty = new Set<string>();
      applyExpanded(empty);
      props.onExpand?.(empty);
      return;
    }

    const token = ++expandGeneration;
    let index = 0;
    // Local accumulator so each chunk builds on the previous without lag.
    const acc = new Set<string>();

    // Start empty so we fill in document order (parents before deep children).
    applyExpanded(new Set(acc));
    reportProgress({ done: 0, total });

    const step = () => {
      if (token !== expandGeneration) return;

      const end = Math.min(index + EXPAND_CHUNK, total);
      while (index < end) {
        acc.add(keys[index]);
        index += 1;
      }

      // Single apply per frame — this is the expensive, blocking re-render.
      applyExpanded(new Set(acc));
      reportProgress({ done: index, total });

      if (index < total) {
        // Return from the callback so the browser can paint / handle input,
        // then continue on the next frame.
        requestAnimationFrame(step);
        return;
      }

      reportProgress(null);
      props.onExpand?.(new Set(acc));
    };

    requestAnimationFrame(step);
  };

  const isExpanding = () => expandProgress() !== null;

  const handle: JsonTreeViewHandle = {
    expandAll,
    collapseAll,
    isExpanding,
    getRoot: () => treeRootEl ?? null,
  };

  createEffect(() => {
    assignRef(props.ref, handle);
  });

  onCleanup(() => {
    expandGeneration += 1;
  });

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

  /** Open every path key in `keys` (union with current expanded set). */
  const expandPathKeys = (keys: string[]) => {
    if (keys.length === 0) return;
    const next = new Set(expanded());
    let changed = false;
    for (const k of keys) {
      if (!next.has(k)) {
        next.add(k);
        changed = true;
      }
    }
    if (changed) applyExpanded(next);
  };

  /** Expand direct child containers under `path` (one level). */
  const expandChildren = (path: JsonPath) => {
    expandPathKeys(collectChildContainerPathKeys(displayRoot(), path));
  };

  /**
   * Collapse descendants under `path` while keeping this container open.
   * Removes expand state for every nested container key (not the path itself).
   */
  const collapseChildren = (path: JsonPath) => {
    const prefix = pathKey(path);
    const sep = '\0';
    const prev = expanded();
    const next = new Set<string>();
    let changed = false;
    for (const k of prev) {
      // Keep self; drop any key strictly under this path.
      if (prefix === ROOT_PATH_KEY) {
        if (k !== ROOT_PATH_KEY) {
          changed = true;
          continue;
        }
      } else if (k.startsWith(prefix + sep)) {
        changed = true;
        continue;
      }
      next.add(k);
    }
    if (changed) applyExpanded(next);
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

  const errorMessage = () => {
    const v = validity();
    return v.ok ? null : v.error;
  };

  const errorHint = () => {
    const v = validity();
    if (v.ok) return null;
    if (v.reason === 'invalid-root') {
      return 'Showing empty object. Change the root type below or fix the source.';
    }
    return lastGoodRoot()
      ? 'Showing the last valid tree. Fix JSON syntax in the source editor.'
      : 'Showing empty object. Fix JSON syntax in the source editor.';
  };

  return (
    <div
      class="json-tree"
      part="tree"
      ref={(el) => {
        treeRootEl = el;
      }}
    >
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
          onExpandChildren={expandChildren}
          onCollapseChildren={collapseChildren}
          onCommit={commit}
          focusedPathKey={focusedPathKey}
          onFocusPath={onFocusPath}
          arrayReorderController={arrayReorderController}
        />
      </div>
    </div>
  );
};
