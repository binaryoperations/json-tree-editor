import { createSignal } from 'solid-js';

import { definePlugin } from '../plugin';
import type { PluginContext } from '../lib/editor-runtime/types';
import { pointerToJsonPath } from '../lib/json-path-utils';
import { BreadcrumbBar } from './BreadcrumbBar';
import { createFlashRing } from './flash-ring';
import type { BreadcrumbsPluginOptions, JsonPath } from './types';

/** Command name this plugin masters. */
export const SELECT_PATH_COMMAND = 'selectPath';

const DEFAULT_MAX_SEGMENTS = 8;

/** Accept either a `JsonPath` array or an RFC 6901 JSON Pointer string. */
function toJsonPath(input: unknown): JsonPath {
  if (Array.isArray(input)) return input as JsonPath;
  if (typeof input === 'string') return pointerToJsonPath(input);
  return [];
}

/**
 * Breadcrumb path bar for `JsonTreeView`.
 *
 * **Contributes UI** via the optional plugin `render` hook (`stage: 'head'` by
 * default) and **masters the `selectPath` command**, composing the view
 * primitives (`json-tree.expandPath` + `json-tree.revealPath`) into: expand
 * ancestors → scroll the row into view → flash a ring around its key.
 *
 * `selectPath` is registered non-exclusively, so a later plugin registering the
 * same name becomes a subordinate rather than replacing this one.
 *
 * @example
 * ```tsx
 * const plugins = [breadcrumbsPlugin()];
 * <JsonTreeView value={json()} onChange={setJson} plugins={plugins} />
 * ```
 */
export function breadcrumbsPlugin(options: BreadcrumbsPluginOptions = {}) {
  const {
    stage = 'head',
    focus = true,
    flash = true,
    maxSegments = DEFAULT_MAX_SEGMENTS,
    label = 'JSON path',
    rootLabel = 'root',
  } = options;

  // One editor per plugin instance — the bar reads this signal, the focused
  // path subscription writes it.
  const [path, setPath] = createSignal<JsonPath>([]);

  // The ring is this plugin's decoration on a row the view revealed, so the
  // timers live here and are cleared on teardown.
  const ring = createFlashRing();

  return definePlugin({
    name: 'breadcrumbs',
    stage,

    setup(ctx) {
      const initial = ctx.callCommand<JsonPath>('json-tree.getFocusedPath');
      if (Array.isArray(initial)) setPath(initial);

      const unsubscribe = ctx.callCommand<() => void>(
        'json-tree.onFocusedPathChange',
        (next: JsonPath) => setPath(next),
      );

      ctx.registerCommand(
        SELECT_PATH_COMMAND,
        async (...args: unknown[]): Promise<boolean> => {
          const target = toJsonPath(args[0]);
          const opts = (args[1] ?? {}) as { focus?: boolean; flash?: boolean };
          ctx.callCommand('json-tree.expandPath', target);
          const row = await ctx.callCommand<Promise<HTMLElement | null>>(
            'json-tree.revealPath',
            target,
            { focus: opts.focus ?? focus },
          );
          if (!row) return false;
          // After the scroll lands, not before it starts.
          if (opts.flash ?? flash) {
            requestAnimationFrame(() => ring.flash(row));
          }
          return true;
        },
      );

      return () => {
        unsubscribe?.();
        ring.dispose();
      };
    },

    render(_stage, ctx: PluginContext) {
      return (
        <BreadcrumbBar
          path={path()}
          label={label}
          rootLabel={rootLabel}
          maxSegments={maxSegments}
          onSelect={(next) => {
            void ctx.callCommand(SELECT_PATH_COMMAND, next);
          }}
        />
      );
    },
  });
}
