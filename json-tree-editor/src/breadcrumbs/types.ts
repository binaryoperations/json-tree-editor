/** Public option / type surface for the breadcrumbs plugin. */

import type { JsonPath } from '../lib/json-path';
import type { PluginRenderStage } from '../lib/editor-runtime/types';

export type BreadcrumbsPluginOptions = {
  /**
   * Where the bar mounts inside the tree view.
   * - `'head'` (default) — above the find bar and the tree
   * - `'tail'` — below the tree
   */
  stage?: PluginRenderStage;
  /**
   * Move DOM focus to the row after a segment click. Default `true`.
   * Set `false` to scroll without stealing focus from an open editor.
   */
  focus?: boolean;
  /** Flash a ring around the target key once the scroll lands. Default `true`. */
  flash?: boolean;
  /**
   * Maximum segments rendered before the middle collapses to an ellipsis.
   * Root and the last two segments are always kept. Default `8`; `0` disables
   * collapsing.
   */
  maxSegments?: number;
  /** `aria-label` for the nav landmark. Default `'JSON path'`. */
  label?: string;
  /** Label for the root segment. Default `'root'`. */
  rootLabel?: string;
};

/** One rendered crumb. `path` is the full path this segment addresses. */
export type BreadcrumbSegment = {
  label: string;
  path: JsonPath;
  /** True for array indices — rendered in the index color. */
  isIndex: boolean;
};

export type { JsonPath, PluginRenderStage };
