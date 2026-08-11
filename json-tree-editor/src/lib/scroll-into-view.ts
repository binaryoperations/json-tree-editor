/**
 * Scroll helpers for the tree scroller.
 *
 * Container rows use `position: sticky; top: 0`, so a plain
 * `scrollIntoView({ block: 'nearest' })` often leaves the target under the
 * stuck parent header (any pixel of the node still counts as "visible").
 */

/** Gap below the sticky band / above the scroller bottom. */
export const TREE_SCROLL_PAD_PX = 8;

/**
 * Height of the sticky header band that would cover `item`.
 *
 * All sticky rows pin to `top: 0` (they stack in z-index, not in offset), so
 * the band is one row tall — the tallest sticky **ancestor** of `item`.
 * The item's own row is excluded (scrolling to a container header needs no
 * self-offset).
 */
export function measureStickyTopInset(
  scroller: HTMLElement,
  item: HTMLElement,
): number {
  let inset = 0;
  const stickies = scroller.querySelectorAll<HTMLElement>(
    '.json-tree-node--container[aria-expanded="true"] > .json-tree-row',
  );
  for (let i = 0; i < stickies.length; i += 1) {
    const row = stickies[i];
    const node = row.parentElement;
    if (!(node instanceof HTMLElement)) continue;
    if (node === item) continue;
    if (!node.contains(item)) continue;
    inset = Math.max(inset, row.getBoundingClientRect().height);
  }
  return inset;
}

/**
 * Scroll `item` inside `scroller` so its row is fully below sticky ancestors
 * and above the scroller bottom (with a small pad).
 *
 * Mutates `scroller.scrollTop` only when the target is outside the safe band.
 * Safe in jsdom (no `scrollIntoView` / `scrollBy` required).
 */
export function scrollTreeItemIntoView(
  scroller: HTMLElement,
  item: HTMLElement,
  pad: number = TREE_SCROLL_PAD_PX,
): void {
  const scrollerRect = scroller.getBoundingClientRect();
  const row = item.querySelector(':scope > .json-tree-row');
  const target = row instanceof HTMLElement ? row : item;
  const targetRect = target.getBoundingClientRect();

  const topInset = measureStickyTopInset(scroller, item);
  const visibleTop = scrollerRect.top + topInset + pad;
  const visibleBottom = scrollerRect.bottom - pad;

  let delta = 0;
  if (targetRect.top < visibleTop) {
    delta = targetRect.top - visibleTop;
  } else if (targetRect.bottom > visibleBottom) {
    delta = targetRect.bottom - visibleBottom;
  }
  if (delta === 0) return;

  scroller.scrollTop += delta;
}
