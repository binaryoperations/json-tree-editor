/**
 * HTML5 drag-and-drop array reorder strategy.
 *
 * Import via `@binaryoperations/json-tree-editor/dnd` and pass to
 * `JsonTreeView` as `arrayReorder={HTML5_ARRAY_REORDER}`.
 */

import { createSignal } from 'solid-js';

import {
  arrayDropTargetIndex,
  type JsonPath,
  moveArrayItemAtPath,
} from '../../lib/json-path';
import type {
  ArrayDragEdge,
  ArrayDragState,
  ArrayItemReorderUi,
  ArrayReorderBinding,
  ArrayReorderController,
  ArrayReorderParent,
  ArrayReorderParentContext,
} from './array-reorder';

const DRAG_MIME = 'application/x-jte-array-reorder';

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
    onDragStart: (e: DragEvent) => {
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
    onDragEnd: () => {
      binding()?.onDragEnd();
    },
    onMouseDown: (e: MouseEvent) => {
      e.stopPropagation();
    },
  };
}

/** HTML5 drag-and-drop reorder strategy (opt-in via `/dnd`). */
export const HTML5_ARRAY_REORDER: ArrayReorderController = {
  createParent: createHtml5ArrayReorderParent,
  createItemUi: createHtml5ArrayItemUi,
};
