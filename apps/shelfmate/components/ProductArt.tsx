import type { Step } from "@/lib/catalog";

/** A small illustrated tile per routine step: pump bottle, dropper, jar, tube. Decorative, so hidden from screen readers. */
export default function ProductArt({ step, size }: { step: Step; size?: number }) {
  const g = {
    Cleanse: <><rect x="9" y="12" width="14" height="17" rx="3" /><path d="M16 12V7h5M14 7h4" /></>,
    Treat: <><rect x="10" y="14" width="12" height="15" rx="3" /><path d="M16 14V9M13 9h6M16 9V4" /></>,
    Moisturize: <><rect x="6" y="14" width="20" height="13" rx="4" /><path d="M8 14v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" /></>,
    Protect: <><path d="M11 29l1.5-18h7L21 29z" /><path d="M13 11V7h6v4" /></>,
  }[step];
  return <span className={"art " + step} style={size ? ({ ["--s" as string]: size + "px" } as React.CSSProperties) : undefined} aria-hidden="true"><svg viewBox="0 0 32 36">{g}</svg></span>;
}
