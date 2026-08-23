// ─── Focus trap helpers ────────────────────────────────────────
// Keeps keyboard Tab navigation cycling within a container while a modal
// dialog is open, instead of escaping into the rest of the page.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: ParentNode): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((el) => el.offsetParent !== null);
}

/**
 * Wraps Tab/Shift+Tab within `container`'s focusable elements. Call from a
 * `keydown` handler scoped to (or bubbling up through) the container.
 */
export function trapTabFocus(
  e: KeyboardEvent,
  container: ParentNode,
  activeElement: Element | null,
  onEmptyFallback: () => void
): void {
  const focusable = getFocusableElements(container);

  if (focusable.length === 0) {
    e.preventDefault();
    onEmptyFallback();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeIndex = activeElement ? focusable.indexOf(activeElement as HTMLElement) : -1;

  if (e.shiftKey) {
    if (activeIndex <= 0) {
      e.preventDefault();
      last.focus();
    }
  } else if (activeIndex === -1 || activeIndex === focusable.length - 1) {
    e.preventDefault();
    first.focus();
  }
}
