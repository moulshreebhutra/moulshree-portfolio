"use client";
import { useLayoutEffect, useRef } from "react";

/** FLIP reorder animation: when `key` changes, children with data-flip move smoothly from their old position to the new one. */
export function useFlip<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const prev = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    el.querySelectorAll<HTMLElement>("[data-flip]").forEach((c) => {
      const id = c.dataset.flip!, top = c.getBoundingClientRect().top;
      next.set(id, top);
      const was = prev.current.get(id);
      if (!reduce && was !== undefined && Math.abs(was - top) > 2 && c.animate)
        c.animate([{ transform: `translateY(${was - top}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.23,1,.32,1)" });
    });
    prev.current = next;
  }, [key]);
  return ref;
}
