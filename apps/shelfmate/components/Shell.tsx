"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cartCount, readCart } from "@/lib/client";

export default function Shell({ children, badges }: { children: React.ReactNode; badges?: React.ReactNode }) {
  const path = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => { const f = () => setN(cartCount(readCart())); f(); window.addEventListener("cart", f); window.addEventListener("storage", f); return () => { window.removeEventListener("cart", f); window.removeEventListener("storage", f); }; }, []);
  const cur = (p: string) => (path === p ? "page" : undefined);
  return (
    <>
      <header className="top"><div className="wrap">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <svg viewBox="0 0 48 48" width="40" height="40" role="img" aria-label="Shelfmate logo"><rect x="1" y="1" width="46" height="46" rx="12" fill="none" stroke="var(--line)" strokeWidth="1.5" /><path d="M7 38.5H41" stroke="var(--muted)" strokeWidth="2.6" strokeLinecap="round" /><rect x="10" y="18" width="7" height="20" rx="2" fill="var(--muted)" opacity=".45" /><rect x="20.5" y="9" width="7" height="29" rx="2" fill="var(--accent)" /><rect x="31" y="18" width="7" height="20" rx="2" fill="var(--muted)" opacity=".45" /></svg>
          <div>Shelfmate<small>A routine that builds itself, and a dashboard that proves it.</small></div>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/" aria-current={cur("/")}>Shop</Link>
          <Link href="/merchant" aria-current={cur("/merchant")}>Merchant view</Link>
          <Link href="/cart" aria-current={cur("/cart")}>Cart{n > 0 && <span className="cartn">{n}</span>}</Link>
        </nav>
        {badges && <div className="badges">{badges}</div>}
      </div></header>
      {children}
      <footer><div className="wrap">Shelfmate is a concept project by <a href="https://moulshree-portfolio.vercel.app">Moulshree Bhutra</a>. The skincare brand is invented, nothing here is sold, and no payment or personal details are collected. <a href="https://github.com/moulshreebhutra/moulshree-portfolio/tree/main/apps/shelfmate">Source</a></div></footer>
    </>
  );
}
