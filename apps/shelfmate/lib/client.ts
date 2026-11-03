"use client";
// Browser-side helpers: an anonymous session id and the cart. Nothing here identifies a person.
export interface Cart { bundle: string[]; items: string[] }
const CART = "shelfmate-cart-v1", SIDK = "shelfmate-sid-v1";
export const emptyCart: Cart = { bundle: [], items: [] };

export function getSid(): string {
  try {
    let s = localStorage.getItem(SIDK);
    if (!s || !/^[a-z0-9]{10,24}$/.test(s)) {
      s = Date.now().toString(36).padStart(9, "0") + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
      localStorage.setItem(SIDK, s);
    }
    return s;
  } catch { return Date.now().toString(36).padStart(9, "0") + "anonymous"; }
}
export function readCart(): Cart {
  try { const c = JSON.parse(localStorage.getItem(CART) || "null"); if (c && Array.isArray(c.bundle) && Array.isArray(c.items)) return c; } catch { /* ignore */ }
  return emptyCart;
}
export function writeCart(c: Cart) { try { localStorage.setItem(CART, JSON.stringify(c)); window.dispatchEvent(new Event("cart")); } catch { /* ignore */ } }
export function cartCount(c: Cart) { return (c.bundle.length ? 1 : 0) + c.items.length; }
export async function post<T = any>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({} as T)) };
}
