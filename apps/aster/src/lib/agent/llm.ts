// ---------------------------------------------------------------------------
// LLM provider abstraction with a fallback chain:
//   Claude (Anthropic)  ->  Gemini (free tier)  ->  OpenAI  ->  deterministic offline provider
//
// The offline provider is not a toy: it lets the full agent, the eval harness
// and the demo run reproducibly with zero API keys. When ANTHROPIC_API_KEY is
// set (your case), Claude is used for the composer. Evals force offline mode so
// their scores are deterministic and reviewable.
// ---------------------------------------------------------------------------

export type Tier = "small" | "mid" | "large";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMResult {
  text: string;
  provider: "anthropic" | "gemini" | "openai" | "offline";
  model: string;
  tokensIn: number;
  tokensOut: number;
  costMicros: number; // micro-USD
}

export function isOffline(): boolean {
  if (process.env.ASTER_OFFLINE === "1") return true;
  return !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY;
}

// Rough public list prices (USD per 1M tokens) for cost tracking in the
// dashboard. Adjust in one place if pricing changes.
// ASSUMED list prices, used only for the dashboard cost readout: verify against the
// provider's pricing page before quoting any cost figure.
const PRICES: Record<string, { in: number; out: number }> = {
  "haiku": { in: 0.8, out: 4 },
  "gemini": { in: 0, out: 0 }, // free tier
  "claude-3-5-haiku": { in: 0.8, out: 4 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  offline: { in: 0, out: 0 },
};

function priceFor(model: string): { in: number; out: number } {
  const key = Object.keys(PRICES).find((k) => model.includes(k));
  return PRICES[key ?? "offline"] ?? PRICES.offline;
}

function costMicros(model: string, tokensIn: number, tokensOut: number): number {
  const p = priceFor(model);
  const usd = (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
  return Math.round(usd * 1e6);
}

function anthropicModel(tier: Tier): string {
  // Cost-safe defaults: Haiku everywhere. Sonnet is opt-in via env for teams
  // that want higher answer quality and accept the higher price.
  if (tier === "large") return process.env.ANTHROPIC_MODEL_LARGE || "claude-haiku-5-5";
  if (tier === "small") return process.env.ANTHROPIC_MODEL_SMALL || "claude-haiku-5-5";
  return process.env.ANTHROPIC_MODEL_MID || "claude-haiku-5-5";
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

async function callGemini(
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<LLMResult> {
  const model = geminiModel();
  // Key goes in a header, never in the URL, so it cannot leak into logs.
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const text: string = (json.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  if (!text.trim()) throw new Error("Gemini returned no text");
  const tokensIn = json.usageMetadata?.promptTokenCount ?? estimateTokens(system + JSON.stringify(messages));
  const tokensOut = json.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);
  return { text, provider: "gemini", model, tokensIn, tokensOut, costMicros: 0 };
}

function openaiModel(tier: Tier): string {
  if (tier === "large") return process.env.OPENAI_MODEL_LARGE || "gpt-4o";
  return process.env.OPENAI_MODEL_MID || "gpt-4o-mini";
}

async function callAnthropic(
  system: string,
  messages: ChatMessage[],
  tier: Tier,
  maxTokens: number
): Promise<LLMResult> {
  const model = anthropicModel(tier);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const text: string = (json.content ?? [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");
  const tokensIn = json.usage?.input_tokens ?? estimateTokens(system + JSON.stringify(messages));
  const tokensOut = json.usage?.output_tokens ?? estimateTokens(text);
  return {
    text,
    provider: "anthropic",
    model,
    tokensIn,
    tokensOut,
    costMicros: costMicros(model, tokensIn, tokensOut),
  };
}

async function callOpenAI(
  system: string,
  messages: ChatMessage[],
  tier: Tier,
  maxTokens: number
): Promise<LLMResult> {
  const model = openaiModel(tier);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  const tokensIn = json.usage?.prompt_tokens ?? estimateTokens(system + JSON.stringify(messages));
  const tokensOut = json.usage?.completion_tokens ?? estimateTokens(text);
  return {
    text,
    provider: "openai",
    model,
    tokensIn,
    tokensOut,
    costMicros: costMicros(model, tokensIn, tokensOut),
  };
}

function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export interface CompleteOpts {
  system: string;
  messages: ChatMessage[];
  tier: Tier;
  maxTokens?: number;
  /** offline fallback generator — required so callers always degrade safely */
  offline: () => string;
}

/**
 * Complete with the fallback chain. Returns both the text and the provider/cost
 * metadata used for the trace.
 */
export async function complete(opts: CompleteOpts): Promise<LLMResult> {
  const maxTokens = opts.maxTokens ?? 700;

  if (isOffline()) {
    const text = opts.offline();
    const tin = estimateTokens(opts.system + JSON.stringify(opts.messages));
    const tout = estimateTokens(text);
    return { text, provider: "offline", model: "offline", tokensIn: tin, tokensOut: tout, costMicros: 0 };
  }

  const errors: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(opts.system, opts.messages, opts.tier, maxTokens);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGemini(opts.system, opts.messages, maxTokens);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(opts.system, opts.messages, opts.tier, maxTokens);
    } catch (e) {
      errors.push(String(e));
    }
  }
  // Last resort: offline so the user still gets a grounded answer.
  const text = opts.offline();
  const tin = estimateTokens(opts.system + JSON.stringify(opts.messages));
  const tout = estimateTokens(text);
  return { text, provider: "offline", model: "offline(after-fallback)", tokensIn: tin, tokensOut: tout, costMicros: 0 };
}
