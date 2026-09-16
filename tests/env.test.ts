import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

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
