import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';

import { createEditorRuntime } from '../../lib/editor-runtime/create-editor-runtime';
import type {
  EditorCommitMeta,
  JsonTreeEditorPlugin,
} from '../../lib/editor-runtime/types';
import {
  collectChildContainerPathKeys,
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
} from '../../lib/parse-json';
import {
  ancestorPathKeys,
  collectSearchMatches,
  type SearchMatch,
} from '../../lib/search';
import { scrollTreeItemIntoView } from '../../lib/scroll-into-view';
import type { ArrayReorderController } from './array-reorder';
import { JsonTreeNode } from './JsonTreeNode';
import { TreeSearchBar } from './TreeSearchBar';

/** Imperative handle exposed via Solid `ref` on {@link JsonTreeView}. */
export type JsonTreeViewHandle = {
  /** The root `.json-tree` DOM element (or `null` before mount). */
  getRoot: () => HTMLDivElement | null;
  /** Register a plugin; returns a dispose function. */
  use: (plugin: JsonTreeEditorPlugin) => () => void;
  /** Invoke a registered command (master only). Missing → `undefined`. */
  callCommand: <T = unknown>(name: string, ...args: unknown[]) => T | undefined;
  /** Whether a master command is currently registered. */
  hasCommand: (name: string) => boolean;
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
   * - omit / `undefined` / `false` — off (no DnD code path)
   * - {@link ArrayReorderController} — e.g. `HTML5_ARRAY_REORDER` from `/dnd`
   *
   * Reacts to prop changes (toggle on/off without remounting). Prefer a stable
   * controller identity while a drag is in progress.
   */
  arrayReorder?: ArrayReorderController | false;
  /**
   * When true, the tree is read-only: no value/key/type edits, add/delete, or
   * drag-reorder. Expand/collapse and keyboard navigation still work.
   */
  readOnly?: boolean;
  /**
   * In-tree search (Cmd/Ctrl+F). Default `true`. Set `false` to disable the
   * shortcut, find bar, and match highlighting.
   */
  search?: boolean;
  /**
   * Document-lifecycle plugins (history, collab, …). Identity is by
   * `plugin.name` only — same name across re-renders does not re-run setup.
   * Prefer a stable array / stable plugin instances.
   */
  plugins?: JsonTreeEditorPlugin[];
  /** Solid component ref (function form recommended). */
  ref?: JsonTreeViewHandle | ((handle: JsonTreeViewHandle) => void);
};

const SEARCH_DEBOUNCE_MS = 200;

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
 * Per-container **expand** / **collapse** toolbar actions open or fold nested
 * children. Initial open depth is
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
 * Ctrl/Cmd+F opens in-tree search (keys + values).
 */
export const JsonTreeView: Component<JsonTreeViewProps> = (props) => {
  const [internalExpanded, setInternalExpanded] = createSignal<Set<string>>(
    initialExpandedFromProps(props.value, props.defaultExpandedDepth),
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

  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchDraft, setSearchDraft] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeMatchIndex, setActiveMatchIndex] = createSignal(0);

  let treeRootEl: HTMLDivElement | undefined;
  let treeScrollEl: HTMLDivElement | undefined;
  let searchInputEl: HTMLInputElement | undefined;

  /** Search is on by default; only an explicit `search={false}` disables it. */
  const searchEnabled = () => props.search !== false;

  // ── Document runtime (lastEmitted, dispatch, plugins) ──
  // Created once per component instance. Thin until first plugin registration.
  const runtime = createEditorRuntime({
    initialValue: props.value,
    // Solid props proxy — always reads the current host callback.
    onChange: (pretty) => props.onChange(pretty),
    readOnly: props.readOnly,
  });

  onCleanup(() => {
    runtime.dispose();
  });

  createEffect(() => {
    runtime.setReadOnly(!!props.readOnly);
  });

  createEffect(() => {
    runtime.handleHostValue(props.value);
  });

  // Only sync when the host passes `plugins` explicitly. `undefined` leaves
  // imperative `use()` installs alone (does not wipe them with `[]`).
  createEffect(() => {
    const list = props.plugins;
    if (list === undefined) return;
    runtime.setPlugins(list);
  });

  const validity = createMemo(() => parseJsonSource(props.value));

  createEffect(() => {
    const v = validity();
    if (v.ok) {
      setLastGoodRoot(v.value);
    }
  });

  // Tear down find UI if the host disables search while it is open.
  createEffect(() => {
    if (searchEnabled()) return;
    if (!searchOpen() && !searchDraft() && !searchQuery()) return;
    setSearchOpen(false);
    setSearchDraft('');
    setSearchQuery('');
    setActiveMatchIndex(0);
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

  // Snapshot providers for plugins (display root / validity stay view-owned).
  createEffect(() => {
    // Track validity + lastGood so providers stay current.
    void validity();
    void lastGoodRoot();
    runtime.setRootProvider(() => displayRoot());
    runtime.setValidityProvider(() => validity());
  });

  const expanded = (): Set<string> => internalExpanded();

  const applyExpanded = (next: Set<string>) => {
    setInternalExpanded(next);
  };

  const handle: JsonTreeViewHandle = {
    getRoot: () => treeRootEl ?? null,
    use: (plugin) => runtime.use(plugin),
    callCommand: (name, ...args) => runtime.callCommand(name, ...args),
    hasCommand: (name) => runtime.hasCommand(name),
  };

  createEffect(() => {
    assignRef(props.ref, handle);
  });

  // Debounce search draft → applied query.
  createEffect(() => {
    const draft = searchDraft();
    const timer = window.setTimeout(() => {
      setSearchQuery(draft);
      setActiveMatchIndex(0);
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  const matches = createMemo((): SearchMatch[] => {
    if (!searchEnabled()) return [];
    return collectSearchMatches(displayRoot(), searchQuery());
  });

  // Auto-expand ancestors of every match so highlights are visible.
  createEffect(() => {
    const list = matches();
    if (list.length === 0) return;
    const keys: string[] = [];
    for (const m of list) {
      keys.push(...ancestorPathKeys(m.path));
    }
    expandPathKeys(keys);
  });

  // Clamp active index when match list shrinks.
  createEffect(() => {
    const n = matches().length;
    if (n === 0) {
      if (activeMatchIndex() !== 0) setActiveMatchIndex(0);
      return;
    }
    if (activeMatchIndex() >= n) setActiveMatchIndex(0);
  });

  const activeMatch = (): SearchMatch | null => {
    const list = matches();
    if (list.length === 0) return null;
    const i = activeMatchIndex();
    return list[i] ?? list[0] ?? null;
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

  const commit = (
    nextRoot: unknown,
    meta?: Partial<
      Pick<EditorCommitMeta, 'kind' | 'path' | 'coalesceKey' | 'skipHistory'>
    >,
  ) => {
    runtime.commitUi(nextRoot, meta ?? {});
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

  /**
   * Scroll a treeitem into the scroller viewport, clearing sticky parent
   * headers (`top: 0` container rows). Falls back to native scrollIntoView
   * only when the scroller ref is missing.
   */
  const scrollItemIntoView = (item: HTMLElement) => {
    const scroller = treeScrollEl;
    if (scroller) {
      scrollTreeItemIntoView(scroller, item);
      return;
    }
    if (typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  };

  const focusPath = (path: JsonPath) => {
    setFocusedPathKey(pathKey(path));
    const tryFocus = (): boolean => {
      const item = findTreeItem(path);
      if (!item) return false;
      if (document.activeElement !== item) {
        item.focus({ preventScroll: true });
      }
      scrollItemIntoView(item);
      return true;
    };
    if (!tryFocus()) {
      requestAnimationFrame(() => {
        if (!tryFocus()) {
          requestAnimationFrame(() => {
            tryFocus();
          });
        }
      });
    }
  };

  /** After expand/layout, scroll match into view (optionally keep search focused). */
  const revealPath = (path: JsonPath, opts?: { keepSearchFocus?: boolean }) => {
    const run = () => {
      const item = findTreeItem(path);
      if (!item) return false;
      setFocusedPathKey(pathKey(path));
      scrollItemIntoView(item);
      if (opts?.keepSearchFocus) {
        focusSearchInput();
      }
      return true;
    };
    if (!run()) {
      requestAnimationFrame(() => {
        if (!run()) {
          requestAnimationFrame(() => {
            run();
          });
        }
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

  const focusSearchInput = () => {
    const el = searchInputEl;
    if (!el) return;
    el.focus();
    el.select();
  };

  const openSearch = () => {
    if (!searchEnabled()) return;
    setSearchOpen(true);
    // Focus after the bar mounts.
    requestAnimationFrame(() => {
      focusSearchInput();
    });
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchDraft('');
    setSearchQuery('');
    setActiveMatchIndex(0);
    // Restore focus to the last focused tree row.
    const k = focusedPathKey();
    const root = displayRoot();
    const visible = collectVisiblePaths(root, expanded());
    const path = visible.find((p) => pathKey(p) === k) ?? visible[0];
    if (path) {
      requestAnimationFrame(() => focusPath(path));
    }
  };

  const goToMatch = (index: number) => {
    const list = matches();
    if (list.length === 0) return;
    const next = ((index % list.length) + list.length) % list.length;
    setActiveMatchIndex(next);
    const m = list[next];
    // Expand ancestors of this match (also covered by bulk expand effect).
    expandPathKeys(ancestorPathKeys(m.path));
    // Double rAF: wait for expand layout, then sticky-aware scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        revealPath(m.path, { keepSearchFocus: true });
      });
    });
  };

  const goNextMatch = () => {
    const list = matches();
    if (list.length === 0) return;
    goToMatch(activeMatchIndex() + 1);
  };

  const goPrevMatch = () => {
    const list = matches();
    if (list.length === 0) return;
    goToMatch(activeMatchIndex() - 1);
  };

  // Jump to first match when debounced query yields results (index 0).
  createEffect(() => {
    const list = matches();
    const q = searchQuery().trim();
    if (!searchOpen() || !q || list.length === 0) return;
    // Only auto-scroll when index is 0 after a query change (set in debounce).
    if (activeMatchIndex() !== 0) return;
    const m = list[0];
    expandPathKeys(ancestorPathKeys(m.path));
    // Don't steal focus from the search input — just scroll the row into view.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const item = findTreeItem(m.path);
        if (item) scrollItemIntoView(item);
      });
    });
  });

  const onTreeRootKeyDown = (e: KeyboardEvent) => {
    if (!searchEnabled()) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      e.stopPropagation();
      if (searchOpen()) {
        focusSearchInput();
      } else {
        openSearch();
      }
      return;
    }
  };

  const onTreeKeyDown = (e: KeyboardEvent) => {
    // Allow navigation/expand when read-only; skip only if typing in an editor.
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

  const matchCountDisplay = () => {
    const n = matches().length;
    if (n === 0) return { active: 0, total: 0 };
    return { active: activeMatchIndex() + 1, total: n };
  };

  return (
    <div
      class="json-tree"
      part="tree"
      ref={(el) => {
        treeRootEl = el;
      }}
      onKeyDown={onTreeRootKeyDown}
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

      <Show when={searchEnabled() && searchOpen()}>
        <TreeSearchBar
          value={searchDraft()}
          onInput={setSearchDraft}
          activeIndex={matchCountDisplay().active}
          matchCount={matchCountDisplay().total}
          onPrev={goPrevMatch}
          onNext={goNextMatch}
          onClose={closeSearch}
          inputRef={(el) => {
            searchInputEl = el;
          }}
        />
      </Show>

      <div
        class="json-tree__scroll"
        part="scroll"
        role="tree"
        aria-label="JSON tree"
        aria-readonly={props.readOnly ? 'true' : undefined}
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
          readOnly={props.readOnly}
          highlightQuery={searchEnabled() ? searchQuery : undefined}
          activeMatch={searchEnabled() ? activeMatch : undefined}
          arrayReorderController={
            props.readOnly ? undefined : props.arrayReorder || undefined
          }
        />
      </div>
    </div>
  );
};
