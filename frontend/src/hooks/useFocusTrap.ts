import { useEffect } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const allElements = Array.from(
        container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => {
        const isDisabled = el.hasAttribute("disabled") || (el as any).disabled;
        return !isDisabled;
      });

      // Filter by offsetParent only if there is at least one element with a non-null offsetParent in the container
      // (which indicates offsetParent is supported and some elements have layout).
      const hasLayout = allElements.some((el) => el.offsetParent !== null);
      const focusables = hasLayout
        ? allElements.filter((el) => el.offsetParent !== null)
        : allElements;

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, containerRef]);
}
