/**
 * Public breadcrumbs surface: `@binaryoperations/json-tree-editor/breadcrumbs`
 *
 * A path bar for the focused tree row, shipped as a plugin: it contributes UI
 * through the optional `render` hook and masters the `selectPath` command.
 *
 * Docs: see `./README.md` in this folder.
 */

export { breadcrumbsPlugin, SELECT_PATH_COMMAND } from './breadcrumbs-plugin';

export { BreadcrumbBar, buildSegments } from './BreadcrumbBar';
export type { BreadcrumbBarProps } from './BreadcrumbBar';

export type {
  BreadcrumbSegment,
  BreadcrumbsPluginOptions,
} from './types';
