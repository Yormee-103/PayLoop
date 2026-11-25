export type PitchSlideLike = {
  title: string;
  sub?: string;
  bullets?: string[];
};

export type PitchKey = {
  key: string;
  target: EventTarget | null;
  preventDefault: () => void;
};

export type PitchKeyDirection = -1 | 0 | 1;

const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === "undefined") return false;
  const element = target instanceof Element ? target : null;
  return !!element?.closest(INTERACTIVE_SELECTOR);
}

export function getPitchKeyDirection(event: PitchKey, options?: { allowSpace?: boolean }): PitchKeyDirection {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    return 1;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    return -1;
  }
  const isSpace = event.key === " " || event.key === "Spacebar";
  if (isSpace && options?.allowSpace !== false && !isInteractiveTarget(event.target)) {
    event.preventDefault();
    return 1;
  }
  return 0;
}

export function slideChangeAnnouncement(index: number, slides: readonly PitchSlideLike[]): string {
  const slide = slides[index];
  if (!slide) return "";
  return `Slide ${index + 1} of ${slides.length}: ${slide.title}`;
}

export function activeDotAriaCurrent(index: number, activeIndex: number): "true" | undefined {
  return index === activeIndex ? "true" : undefined;
}

export function nextSlideIndex(index: number, slides: readonly unknown[]): number {
  if (slides.length === 0) return 0;
  return Math.min(slides.length - 1, index + 1);
}

export function previousSlideIndex(index: number): number {
  return Math.max(0, index - 1);
}
