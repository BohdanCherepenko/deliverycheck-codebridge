import { afterEach, describe, expect, it, vi } from "vitest";

import { getServerConfig } from "@/lib/config";

describe("bounded server configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("bounds stalled AI attempts well below the route wall-clock limit", () => {
    vi.stubEnv("GEMINI_TIMEOUT_MS", "");
    vi.stubEnv("GEMINI_MAX_RETRIES", "");
    const config = getServerConfig();

    expect(config.timeoutMs).toBe(15_000);
    expect(config.maxRetries).toBe(1);
    expect(config.rateLimitPerHour).toBe(20);
    expect(config.timeoutMs * (config.maxRetries + 1)).toBeLessThan(90_000);
  });

  it("rejects a per-attempt timeout that could exhaust the route budget", () => {
    vi.stubEnv("GEMINI_TIMEOUT_MS", "40001");
    expect(() => getServerConfig()).toThrow(/between 5000 and 40000/i);
  });

  it("uses only the Gemini provider configuration", () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("GEMINI_VISION_MODEL", "gemini-test-model");
    vi.stubEnv("OPENAI_API_KEY", "must-not-be-used");

    expect(getServerConfig()).toMatchObject({
      apiKey: "gemini-test-key",
      model: "gemini-test-model",
    });
  });
});
