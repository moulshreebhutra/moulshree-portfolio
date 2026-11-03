"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { cartCount, readCart } from "@/lib/client";

export interface ToastDetail { text: string; href?: string; label?: string }
export const toast = (d: ToastDetail) => window.dispatchEvent(new CustomEvent("toast", { detail: d }));

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [n, setN] = useState(0);
  const [edge, setEdge] = useState(false);
  const [t, setT] = useState<ToastDetail | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const f = () => setN(cartCount(readCart())); f();
    const s = () => setEdge(window.scrollY > 4); s();
    const tt = (e: Event) => { setT((e as CustomEvent<ToastDetail>).detail); setShow(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setShow(false), 4200); };
    window.addEventListener("cart", f); window.addEventListener("storage", f); window.addEventListener("scroll", s, { passive: true }); window.addEventListener("toast", tt);
    return () => { window.removeEventListener("cart", f); window.removeEventListener("storage", f); window.removeEventListener("scroll", s); window.removeEventListener("toast", tt); };
  }, []);
  const cur = (p: string) => (path === p ? "page" : undefined);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className={"top" + (edge ? " edge" : "")}><div className="wrap">
        <Link href="/" className="brand">
          <svg viewBox="0 0 48 48" width="40" height="40" role="img" aria-label="Shelfmate logo"><rect x="1" y="1" width="46" height="46" rx="12" fill="none" stroke="var(--line2)" strokeWidth="1.5" /><path d="M7 38.5H41" stroke="var(--muted)" strokeWidth="2.6" strokeLinecap="round" /><rect x="10" y="18" width="7" height="20" rx="2" fill="var(--muted)" opacity=".45" /><rect x="20.5" y="9" width="7" height="29" rx="2" fill="var(--accent)" /><rect x="31" y="18" width="7" height="20" rx="2" fill="var(--muted)" opacity=".45" /></svg>
          <div>Shelfmate<small>A routine that builds itself.</small></div>
        </Link>
        <div className="right">
          <nav className="nav" aria-label="Main">
            <Link href="/" aria-current={cur("/")}>Shop</Link>
            <Link href="/merchant" aria-current={cur("/merchant")}>Merchant view</Link>
            <Link href="/cart" aria-current={cur("/cart")}>Cart{n > 0 && <span className="cartn" key={n} aria-label={`${n} in cart`}>{n}</span>}</Link>
          </nav>
          <ThemeToggle />
        </div>
      </div></header>
      <div id="main" tabIndex={-1} style={{ outline: "none" }}>{children}</div>
      <div className={"toast" + (show ? " show" : "")} role="status" aria-live="polite">{t && <><span>{t.text}</span>{t.href && <a href={t.href}>{t.label ?? "View"}</a>}</>}</div>
      <footer><div className="wrap">Shelfmate is a concept project by <a href="https://moulshree-portfolio.vercel.app">Moulshree Bhutra</a>. The skincare brand is invented, nothing here is sold, and no payment or personal details are collected. <a href="https://github.com/moulshreebhutra/moulshree-portfolio/tree/main/apps/shelfmate">Source</a></div></footer>
    </>
  );
}
