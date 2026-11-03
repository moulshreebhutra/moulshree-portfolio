// One entry point for every model call. Order: Claude, then Gemini (free tier), then the caller's own rules.
// Keys come from server environment variables only and never reach the browser.
import { spendOk } from "./limit";

export type Provider = "claude" | "gemini";
export class AiError extends Error {
  constructor(public code: "off" | "cap" | "failed" | "bad_output", msg: string) { super(msg); }
}

export const aiConfigured = () => ({ claude: !!process.env.ANTHROPIC_API_KEY, gemini: !!process.env.GEMINI_API_KEY });

interface Req { system?: string; prompt: string; maxTokens: number; json?: boolean; timeoutMs?: number }

async function claude(r: Req): Promise<string> {
  const res = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: r.maxTokens,
      ...(r.system ? { system: r.system } : {}),
      messages: [{ role: "user", content: r.prompt }],
    }),
    signal: AbortSignal.timeout(r.timeoutMs ?? 40_000),
  });
  if (!res.ok) throw new Error("claude " + res.status);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const t = j.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
  if (!t.trim()) throw new Error("claude empty");
  return t;
}

async function gemini(r: Req): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      ...(r.system ? { systemInstruction: { parts: [{ text: r.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: r.prompt }] }],
      generationConfig: { maxOutputTokens: r.maxTokens, temperature: 0.3, ...(r.json ? { responseMimeType: "application/json" } : {}) },
    }),
    signal: AbortSignal.timeout(r.timeoutMs ?? 40_000),
  });
  if (!res.ok) throw new Error("gemini " + res.status);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!t.trim()) throw new Error("gemini empty");
  return t;
}

/**
 * Tries each configured provider in order. If `accept` rejects a provider's answer (bad JSON, failed checks),
 * the next provider gets a turn. Throws AiError when none produced something usable.
 */
export async function ask<T>(r: Req, accept: (text: string) => T): Promise<{ value: T; provider: Provider }> {
  const cfg = aiConfigured();
  const chain: [Provider, (x: Req) => Promise<string>][] = [];
  if (cfg.claude) chain.push(["claude", claude]);
  if (cfg.gemini) chain.push(["gemini", gemini]);
  if (!chain.length) throw new AiError("off", "No AI key is set on this deployment.");
  if (!(await spendOk())) throw new AiError("cap", "Today's AI budget for this demo is used up.");
  let last = "";
  for (const [name, fn] of chain) {
    try {
      const text = await fn(r);
      try { return { value: accept(text), provider: name }; } catch (e) { last = name + " answer rejected: " + (e as Error).message; }
    } catch (e) { last = (e as Error).message; }
  }
  throw new AiError(last.includes("rejected") ? "bad_output" : "failed", last.replace(/[A-Za-z0-9_-]{30,}/g, "[x]").slice(0, 160));
}

/** Pull the first JSON object or array out of a model answer, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "");
  const a = t.search(/[[{]/);
  if (a < 0) throw new Error("no json");
  const open = t[a], close = open === "[" ? "]" : "}";
  const b = t.lastIndexOf(close);
  if (b <= a) throw new Error("no json");
  return JSON.parse(t.slice(a, b + 1));
}
