import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv, getRateLimitEnv } from "@/lib/env";

describe("getEnv", () => {
  it("returns the Gemini API key when present", () => {
    process.env.GEMINI_API_KEY = "test-key";

    expect(getEnv().GEMINI_API_KEY).toBe("test-key");
  });

  it("throws when the Gemini API key is missing", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(() => getEnv()).toThrow();

    if (original !== undefined) {
      process.env.GEMINI_API_KEY = original;
    }
  });
});

describe("getRateLimitEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns both Upstash vars when both are present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    expect(getRateLimitEnv()).toEqual({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    });
  });

  it("returns null when both Upstash vars are absent", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);

    expect(getRateLimitEnv()).toBeNull();
  });

  it("throws when only the URL is present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);

    expect(() => getRateLimitEnv()).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("throws when only the token is present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    expect(() => getRateLimitEnv()).toThrow(/UPSTASH_REDIS_REST_URL/);
  });
});
