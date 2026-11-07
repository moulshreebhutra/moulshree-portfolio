"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
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
          <Logo />
          <span>Shelfmate</span>
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
