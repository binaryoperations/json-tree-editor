/**
 * Reveal ring — the flash a crumb click leaves on the row it scrolled to.
 *
 * Owned by this plugin, not the tree view: it is decoration on an element the
 * view already handed back from `json-tree.revealPath`.
 */

/** Class carrying the ring animation (defined in the library stylesheet). */
export const FLASH_CLASS = 'json-tree-flash-ring';

/** One pulse of the ring. Must match the CSS animation duration. */
export const FLASH_PULSE_MS = 450;

/** How many times the ring pulses. Must match the CSS iteration count. */
export const FLASH_PULSES = 2;

/** Total time the ring class stays on. */
export const FLASH_MS = FLASH_PULSE_MS * FLASH_PULSES;

/** Pending clears, keyed by the element wearing the ring. */
type FlashTimers = Map<Element, number>;

export function createFlashRing(flashMs: number = FLASH_MS) {
  const timers: FlashTimers = new Map();

  /**
   * Flash a ring around a row's key label.
   *
   * Re-flashing the same element restarts the animation. Falls back to the row
   * itself when it has no key label (the root row).
   */
  const flash = (item: HTMLElement) => {
    const key = item.querySelector(':scope > .json-tree-row .json-tree-key');
    const target = key instanceof HTMLElement ? key : item;

    const prior = timers.get(target);
    if (prior !== undefined) window.clearTimeout(prior);

    target.classList.remove(FLASH_CLASS);
    // Force a reflow so removing + re-adding restarts the animation.
    void target.offsetWidth;
    target.classList.add(FLASH_CLASS);

    timers.set(
      target,
      window.setTimeout(() => {
        target.classList.remove(FLASH_CLASS);
        timers.delete(target);
      }, flashMs),
    );
  };

  /** Clear pending timers and strip any ring still on screen. */
  const dispose = () => {
    for (const [target, timer] of timers) {
      window.clearTimeout(timer);
      target.classList.remove(FLASH_CLASS);
    }
    timers.clear();
  };

  return { flash, dispose };
}
