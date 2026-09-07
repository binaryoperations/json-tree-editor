import { type Component, For, Show } from 'solid-js';

import type { BreadcrumbSegment, JsonPath } from './types';

/** Sentinel inserted where the middle of a long path was collapsed. */
const ELLIPSIS = Symbol('breadcrumb-ellipsis');

type Crumb = BreadcrumbSegment | typeof ELLIPSIS;

/**
 * Build the crumb list for `path`, collapsing the middle when it exceeds
 * `maxSegments`. Root and the last two segments always survive.
 */
export function buildSegments(
  path: JsonPath,
  rootLabel: string,
  maxSegments: number,
): Crumb[] {
  const all: BreadcrumbSegment[] = [
    { label: rootLabel, path: [], isIndex: false },
  ];
  for (let i = 0; i < path.length; i += 1) {
    const seg = path[i];
    all.push({
      label: typeof seg === 'number' ? `[${seg}]` : String(seg),
      path: path.slice(0, i + 1),
      isIndex: typeof seg === 'number',
    });
  }
  if (maxSegments <= 0 || all.length <= maxSegments) return all;
  // root + … + last two
  return [all[0], ELLIPSIS, ...all.slice(-2)];
}

export type BreadcrumbBarProps = {
  path: JsonPath;
  label: string;
  rootLabel: string;
  maxSegments: number;
  onSelect: (path: JsonPath) => void;
};

/**
 * Path bar for the focused tree row.
 *
 * Every segment except the last is a button that scrolls the tree to that
 * ancestor and flashes a ring around its key. The last segment is the current
 * row, so it is inert (`aria-current`) — clicking it would be a no-op.
 */
export const BreadcrumbBar: Component<BreadcrumbBarProps> = (props) => {
  const crumbs = () =>
    buildSegments(props.path, props.rootLabel, props.maxSegments);

  return (
    <nav
      class="json-tree-breadcrumbs"
      part="breadcrumbs"
      aria-label={props.label}
    >
      <ol class="json-tree-breadcrumbs__list">
        <For each={crumbs()}>
          {(crumb, index) => {
            const isLast = () => index() === crumbs().length - 1;
            return (
              <li class="json-tree-breadcrumbs__item">
                <Show when={index() > 0}>
                  <span class="json-tree-breadcrumbs__sep" aria-hidden="true">
                    ›
                  </span>
                </Show>
                <Show
                  when={crumb !== ELLIPSIS ? (crumb as BreadcrumbSegment) : null}
                  fallback={
                    <span
                      class="json-tree-breadcrumbs__ellipsis"
                      aria-label="path truncated"
                    >
                      …
                    </span>
                  }
                >
                  {(seg) => (
                    <Show
                      when={!isLast()}
                      fallback={
                        <span
                          class="json-tree-breadcrumbs__crumb json-tree-breadcrumbs__crumb--current"
                          classList={{
                            'json-tree-breadcrumbs__crumb--index':
                              seg().isIndex,
                          }}
                          aria-current="location"
                        >
                          {seg().label}
                        </span>
                      }
                    >
                      <button
                        type="button"
                        class="json-tree-breadcrumbs__crumb"
                        classList={{
                          'json-tree-breadcrumbs__crumb--index': seg().isIndex,
                        }}
                        onClick={() => props.onSelect(seg().path)}
                      >
                        {seg().label}
                      </button>
                    </Show>
                  )}
                </Show>
              </li>
            );
          }}
        </For>
      </ol>
    </nav>
  );
};
