/**
 * Array sibling reorder — **types only** (erased at compile time).
 *
 * No runtime exports: constants like the handle selector are hardcoded where
 * used so core and `/dnd` do not share a runtime module (avoids a tiny shared
 * chunk for one string).
 *
 * HTML5 implementation: {@link ./array-reorder-html5}, public via
 * `@binaryoperations/json-tree-editor/dnd`.
 */

import type { JsonPath } from '../../lib/json-path';

export type ArrayDragEdge = 'before' | 'after';

/** Visual state for an in-progress array sibling drag (owned by the parent array). */
export type ArrayDragState = {
  fromIndex: number;
  overIndex: number | null;
  edge: ArrayDragEdge | null;
};

/**
 * Binding injected into an array-element node by its parent array controller.
 * Strategies may ignore unused fields; the HTML5 UI uses all of them.
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

/** Indices for a completed array reorder commit (history meta). */
export type ArrayReorderCommitMeta = {
  fromIndex: number;
  toIndex: number;
};

/** Context for creating a parent-array reorder controller instance. */
export type ArrayReorderParentContext = {
  path: () => JsonPath;
  root: () => unknown;
  onCommit: (
    nextRoot: unknown,
    meta?: ArrayReorderCommitMeta,
  ) => void;
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
  /** Grip handle handlers (wired as DOM onDragStart / onDragEnd / onMouseDown). */
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onMouseDown: (e: MouseEvent) => void;
};

/**
 * Replaceable reorder strategy: parent session factory + item UI binder.
 * Prop changes are reactive (toggle on/off without remounting). Prefer a
 * stable identity while a drag is in progress.
 */
export type ArrayReorderController = {
  createParent: (ctx: ArrayReorderParentContext) => ArrayReorderParent;
  createItemUi: (
    binding: () => ArrayReorderBinding | undefined,
  ) => ArrayItemReorderUi;
};
