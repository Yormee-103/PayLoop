"use client";

import { useEffect, useId, useRef } from "react";
import {
  getFocusableElements,
  modalAriaProps,
  nextFocusIndex,
} from "@/lib/modal-a11y";

// One accessible dialog implementation shared by invoice preview, the tour and
// feedback. It closes on Escape and backdrop click, traps Tab inside the
// panel, and returns focus to the element that opened it.
export function Modal({
  open,
  onClose,
  label,
  backdropClassName = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4",
  panelClassName = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  backdropClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel ? getFocusableElements(panel) : [];
    (focusables[0] ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const currentPanel = panelRef.current;
      if (!currentPanel) return;
      const items = getFocusableElements(currentPanel);
      if (items.length === 0) {
        event.preventDefault();
        currentPanel.focus();
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = items[nextFocusIndex(items.length, index, event.shiftKey)];
      event.preventDefault();
      next?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={backdropClassName} {...modalAriaProps(titleId)} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={panelClassName}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">
          {label}
        </h2>
        {children}
      </div>
    </div>
  );
}
