export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// Small pure pieces of the modal behaviour so focus handling can be tested
// without a browser. Modal.tsx owns the DOM effects that call these helpers.
export function getFocusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true"
  );
}

export function nextFocusIndex(
  length: number,
  current: number,
  backwards: boolean
): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return backwards ? length - 1 : 0;
  return (current + (backwards ? -1 : 1) + length) % length;
}

export function modalAriaProps(titleId: string) {
  return {
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-labelledby": titleId,
  };
}
