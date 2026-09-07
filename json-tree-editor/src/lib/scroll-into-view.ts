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
 * Positions by the node's natural (unstuck) offset, so revealing an expanded
 * container from deep inside its own subtree scrolls back up to it.
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
  const rowEl = item.querySelector(':scope > .json-tree-row');
  const row = rowEl instanceof HTMLElement ? rowEl : item;

  // Measure the **node box**, not its row.
  //
  // An expanded container's row is `position: sticky; top: 0`. Once scrolled
  // past, that row reports itself pinned at the top of the scroller — so it
  // looks "already visible" from any depth, and scrolling to it would move
  // by the sticky-inset difference and stop, stranding the viewport deep in
  // the subtree. The node box stays in normal flow, so its top is where the
  // row actually lives.
  const itemRect = item.getBoundingClientRect();
  const rowHeight = row.getBoundingClientRect().height || itemRect.height;
  const targetTop = itemRect.top;
  // Only the header row has to fit — not the whole subtree under it.
  const targetBottom = targetTop + rowHeight;

  const topInset = measureStickyTopInset(scroller, item);
  const visibleTop = scrollerRect.top + topInset + pad;
  const visibleBottom = scrollerRect.bottom - pad;

  let delta = 0;
  if (targetTop < visibleTop) {
    delta = targetTop - visibleTop;
  } else if (targetBottom > visibleBottom) {
    delta = targetBottom - visibleBottom;
  }
  if (delta === 0) return;

  // Browsers clamp a negative scrollTop; be explicit so callers (and jsdom)
  // see the same value. Revealing the root row overshoots by `pad`.
  scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
}
