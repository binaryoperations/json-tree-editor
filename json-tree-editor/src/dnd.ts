/**
 * Drag-and-drop / array reorder surface.
 *
 * Core `JsonTreeView` leaves reorder **off** (`arrayReorder` omitted or
 * `false`). Opt in:
 *
 * ```ts
 * import { JsonTreeView } from '@binaryoperations/json-tree-editor';
 * import { HTML5_ARRAY_REORDER } from '@binaryoperations/json-tree-editor/dnd';
 *
 * <JsonTreeView arrayReorder={HTML5_ARRAY_REORDER} value={…} onChange={…} />
 * ```
 */

export type {
  ArrayDragEdge,
  ArrayDragState,
  ArrayItemReorderUi,
  ArrayReorderBinding,
  ArrayReorderCommitMeta,
  ArrayReorderController,
  ArrayReorderParent,
  ArrayReorderParentContext,
} from './components/primitives/array-reorder';

export {
  HTML5_ARRAY_REORDER,
  createHtml5ArrayItemUi,
  createHtml5ArrayReorderParent,
} from './components/primitives/array-reorder-html5';

/** Path helpers used when implementing custom reorder controllers. */
export {
  arrayDropTargetIndex,
  moveArrayItemAtPath,
  moveArrayItemByDelta,
} from './lib/json-path';
