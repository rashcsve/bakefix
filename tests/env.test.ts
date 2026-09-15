import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

describe("getEnv", () => {
  it("returns the OpenAI API key when present", () => {
    process.env.OPENAI_API_KEY = "test-key";

    expect(getEnv().OPENAI_API_KEY).toBe("test-key");
  });

  it("throws when the OpenAI API key is missing", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(() => getEnv()).toThrow();

    if (original !== undefined) {
      process.env.OPENAI_API_KEY = original;
    }
  });
});
