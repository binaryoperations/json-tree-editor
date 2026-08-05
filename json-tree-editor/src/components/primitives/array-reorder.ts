/**
 * Array sibling reorder — pluggable controller + item UI bindings.
 *
 * Default strategy: HTML5 drag-and-drop with a handle on each array element.
 * Pass {@link NOOP_ARRAY_REORDER} (or `arrayReorder={false}` on the view) to
 * disable, or supply a custom {@link ArrayReorderController}.
 */

import { createSignal } from 'solid-js';

import {
  arrayDropTargetIndex,
  type JsonPath,
  moveArrayItemAtPath,
} from '../../lib/json-path';

export type ArrayDragEdge = 'before' | 'after';

/** Visual state for an in-progress array sibling drag (owned by the parent array). */
export type ArrayDragState = {
  fromIndex: number;
  overIndex: number | null;
  edge: ArrayDragEdge | null;
};

/**
 * Binding injected into an array-element node by its parent array controller.
 * Strategies may ignore unused fields; the default HTML5 UI uses all of them.
 */
export type ArrayReorderBinding = {
  index: number;
  length: number;
  drag: () => ArrayDragState | null;
  onDragStart: (index: number) => void;
  onDragOver: (index: number, edge: ArrayDragEdge) => void;
  onDragEnd: () => void;
  onDrop: (
    fromIndex: number,
    overIndex: number,
    edge: ArrayDragEdge,
  ) => void;
};

/** Context for creating a parent-array reorder controller instance. */
export type ArrayReorderParentContext = {
  path: () => JsonPath;
  root: () => unknown;
  onCommit: (nextRoot: unknown) => void;
  onFocusPath: (path: JsonPath) => void;
  isArray: () => boolean;
  length: () => number;
};

/** Per array-container instance: produce a child binding (or disable). */
export type ArrayReorderParent = {
  forChild(index: number): ArrayReorderBinding | undefined;
};

/**
 * DOM-facing API for one array-element row. Built from an optional binding so
 * JsonTreeNode only spreads handlers/classes and never owns DnD logic.
 */
export type ArrayItemReorderUi = {
  canDrag: () => boolean;
  nodeClassList: () => {
    'json-tree-node--dragging': boolean;
    'json-tree-node--drop-before': boolean;
    'json-tree-node--drop-after': boolean;
  };
  onNodeDragOver: (e: DragEvent) => void;
  onNodeDrop: (e: DragEvent) => void;
  onHandleDragStart: (e: DragEvent) => void;
  onHandleDragEnd: () => void;
  onHandleMouseDown: (e: MouseEvent) => void;
  /** Selector for the drag handle (row mousedown should ignore it). */
  handleSelector: string;
};

/**
 * Replaceable reorder strategy: parent session factory + item UI binder.
 * Keep the controller reference stable for the lifetime of the tree.
 */
export type ArrayReorderController = {
  createParent: (ctx: ArrayReorderParentContext) => ArrayReorderParent;
  createItemUi: (
    binding: () => ArrayReorderBinding | undefined,
  ) => ArrayItemReorderUi;
};

const DRAG_MIME = 'application/x-jte-array-reorder';
export const ARRAY_REORDER_HANDLE_SELECTOR = '.json-tree-drag-handle';

function dropEdgeFromEvent(e: DragEvent): ArrayDragEdge {
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

/** Parent controller: owns drag session and commits `moveArrayItemAtPath`. */
export function createHtml5ArrayReorderParent(
  ctx: ArrayReorderParentContext,
): ArrayReorderParent {
  const [drag, setDrag] = createSignal<ArrayDragState | null>(null);

  const commitDrop = (
    fromIndex: number,
    overIndex: number,
    edge: ArrayDragEdge,
  ) => {
    const toIndex = arrayDropTargetIndex(fromIndex, overIndex, edge);
    const itemPath: JsonPath = [...ctx.path(), fromIndex];
    const nextRoot = moveArrayItemAtPath(ctx.root(), itemPath, toIndex);
    setDrag(null);
    if (nextRoot === ctx.root()) return;
    ctx.onCommit(nextRoot);
    ctx.onFocusPath([...ctx.path(), toIndex]);
  };

  return {
    forChild(index: number): ArrayReorderBinding | undefined {
      if (!ctx.isArray()) return undefined;
      const length = ctx.length();
      if (length < 2) return undefined;
      return {
        index,
        length,
        drag,
        onDragStart: (fromIndex) =>
          setDrag({ fromIndex, overIndex: null, edge: null }),
        onDragOver: (overIndex, edge) => {
          setDrag((prev) => (prev ? { ...prev, overIndex, edge } : prev));
        },
        onDragEnd: () => setDrag(null),
        onDrop: commitDrop,
      };
    },
  };
}

/** Item UI: handle drag + node drop target for the HTML5 strategy. */
export function createHtml5ArrayItemUi(
  binding: () => ArrayReorderBinding | undefined,
): ArrayItemReorderUi {
  const canDrag = () => {
    const b = binding();
    return b != null && b.length > 1;
  };

  const isDraggingSelf = () => {
    const b = binding();
    const d = b?.drag();
    return d != null && b != null && d.fromIndex === b.index;
  };

  const dropEdge = (): ArrayDragEdge | null => {
    const b = binding();
    const d = b?.drag();
    if (!d || !b || d.overIndex !== b.index) return null;
    if (d.fromIndex === b.index) return null;
    return d.edge;
  };

  return {
    canDrag,
    handleSelector: ARRAY_REORDER_HANDLE_SELECTOR,
    nodeClassList: () => ({
      'json-tree-node--dragging': isDraggingSelf(),
      'json-tree-node--drop-before': dropEdge() === 'before',
      'json-tree-node--drop-after': dropEdge() === 'after',
    }),
    onNodeDragOver: (e: DragEvent) => {
      const b = binding();
      const d = b?.drag();
      if (!b || !d) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const edge = dropEdgeFromEvent(e);
      if (d.overIndex !== b.index || d.edge !== edge) {
        b.onDragOver(b.index, edge);
      }
    },
    onNodeDrop: (e: DragEvent) => {
      const b = binding();
      const d = b?.drag();
      if (!b || !d) return;
      e.preventDefault();
      e.stopPropagation();
      b.onDrop(d.fromIndex, b.index, dropEdgeFromEvent(e));
    },
    onHandleDragStart: (e: DragEvent) => {
      const b = binding();
      if (!b || b.length < 2) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      e.dataTransfer?.setData(DRAG_MIME, JSON.stringify({ index: b.index }));
      e.dataTransfer!.effectAllowed = 'move';
      try {
        const row = (e.currentTarget as HTMLElement).closest(
          '.json-tree-row',
        ) as HTMLElement | null;
        if (row && e.dataTransfer) {
          e.dataTransfer.setDragImage(row, 12, 12);
        }
      } catch {
        // setDragImage can throw in some environments; ignore.
      }
      b.onDragStart(b.index);
    },
    onHandleDragEnd: () => {
      binding()?.onDragEnd();
    },
    onHandleMouseDown: (e: MouseEvent) => {
      e.stopPropagation();
    },
  };
}

/** Default HTML5 drag-and-drop reorder strategy. */
export const HTML5_ARRAY_REORDER: ArrayReorderController = {
  createParent: createHtml5ArrayReorderParent,
  createItemUi: createHtml5ArrayItemUi,
};

/** No-op strategy — no handles, no drop targets, no document writes. */
export const NOOP_ARRAY_REORDER: ArrayReorderController = {
  createParent: () => ({
    forChild: () => undefined,
  }),
  createItemUi: () => ({
    canDrag: () => false,
    handleSelector: ARRAY_REORDER_HANDLE_SELECTOR,
    nodeClassList: () => ({
      'json-tree-node--dragging': false,
      'json-tree-node--drop-before': false,
      'json-tree-node--drop-after': false,
    }),
    onNodeDragOver: () => {},
    onNodeDrop: () => {},
    onHandleDragStart: (e) => {
      e.preventDefault();
    },
    onHandleDragEnd: () => {},
    onHandleMouseDown: () => {},
  }),
};

/**
 * Resolve a public prop value to a controller.
 * - `undefined` → HTML5 default
 * - `false` → disabled
 * - controller object → custom
 */
export function resolveArrayReorderController(
  value: ArrayReorderController | false | undefined,
): ArrayReorderController {
  if (value === false) return NOOP_ARRAY_REORDER;
  return value ?? HTML5_ARRAY_REORDER;
}
