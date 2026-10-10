import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("server-side AI key rotation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("ALAN_AI_API_KEY_1", "test-key-one");
    vi.stubEnv("ALAN_AI_API_KEY_2", "test-key-two");
    vi.stubEnv("ALAN_AI_API_KEY_3", "test-key-three");
    vi.stubEnv("ALAN_AI_API_BASE", "https://provider.example.test/v1");
    vi.stubEnv("ALAN_AI_MODEL", "model-for-test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("tries the next protected key after a provider rejection, then rotates the next request", async () => {
    const attempted: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const header = new Headers(init?.headers).get("Authorization") ?? "";
      attempted.push(header);
      if (header === "Bearer test-key-one") return new Response("{}", { status: 401 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { requestAICompletion } = await import("@/features/career/ai-provider");
    const first = await requestAICompletion([{ role: "user", content: "test" }]);
    const second = await requestAICompletion([{ role: "user", content: "test" }]);
    expect(first).toEqual({ ok: true, text: "OK" });
    expect(second).toEqual({ ok: true, text: "OK" });
    expect(attempted).toEqual(["Bearer test-key-one", "Bearer test-key-two", "Bearer test-key-three"]);
  });

  it("does not make a request when every protected key is absent", async () => {
    vi.stubEnv("ALAN_AI_API_KEY_1", "");
    vi.stubEnv("ALAN_AI_API_KEY_2", "");
    vi.stubEnv("ALAN_AI_API_KEY_3", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { requestAICompletion } = await import("@/features/career/ai-provider");
    expect(await requestAICompletion([{ role: "user", content: "test" }])).toEqual({ ok: false, reason: "missing_keys" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
