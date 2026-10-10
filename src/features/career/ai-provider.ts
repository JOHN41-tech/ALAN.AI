export type AIChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type AIResult = { ok: true; text: string } | { ok: false; reason: "missing_keys" | "invalid_endpoint" | "provider_unavailable" | "empty_response" };

type CompletionOptions = { maxTokens?: number; temperature?: number };

// This module is imported only by server actions. Keys never leave the server process.
let nextKeyIndex = 0;

function getKeyring() {
  return [process.env.ALAN_AI_API_KEY_1, process.env.ALAN_AI_API_KEY_2, process.env.ALAN_AI_API_KEY_3]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

function getEndpoint() {
  const raw = process.env.ALAN_AI_API_BASE?.trim() || process.env.OPENAI_API_BASE?.trim() || "https://api.openai.com/v1";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim().slice(0, 6000);
  if (Array.isArray(content)) return content.map((part) => (part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "")).join("\n").trim().slice(0, 6000);
  return "";
}

export async function requestAICompletion(messages: AIChatMessage[], options: CompletionOptions = {}): Promise<AIResult> {
  const keys = getKeyring();
  if (!keys.length) return { ok: false, reason: "missing_keys" };
  const endpoint = getEndpoint();
  if (!endpoint) return { ok: false, reason: "invalid_endpoint" };
  const model = process.env.ALAN_AI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const first = nextKeyIndex % keys.length;
  let hadEmptyResponse = false;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (first + offset) % keys.length;
    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${keys[index]}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: Math.max(128, Math.min(1000, options.maxTokens ?? 700)), temperature: Math.max(0, Math.min(1, options.temperature ?? 0.45)), messages }),
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      const text = extractText(payload);
      if (!text) { hadEmptyResponse = true; continue; }
      nextKeyIndex = (index + 1) % keys.length;
      return { ok: true, text };
    } catch {
      // Do not log response headers, bodies or credentials; try the next key within this bounded request.
    }
  }
  nextKeyIndex = (first + 1) % keys.length;
  return { ok: false, reason: hadEmptyResponse ? "empty_response" : "provider_unavailable" };
}
