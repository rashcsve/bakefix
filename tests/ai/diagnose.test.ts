import { APICallError, RetryError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

import { generateText } from "ai";
import { DiagnoseError, diagnoseBake } from "@/lib/ai/diagnose";
import type { DiagnosisInput } from "@/lib/ai/schema";

const input: DiagnosisInput = {
  category: "Cookies",
  problem: "My cookies spread into thin flat puddles.",
  constraints: [],
};

function apiCallError(statusCode: number) {
  return new APICallError({
    message: "provider failure",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
  });
}

function retryError(lastError: unknown) {
  return new RetryError({
    message: "Failed after 3 attempts",
    reason: "maxRetriesExceeded",
    errors: [lastError],
  });
}

async function codeFor(error: unknown) {
  vi.mocked(generateText).mockRejectedValueOnce(error);
  const thrown = await diagnoseBake(input).catch((e: unknown) => e);
  expect(thrown).toBeInstanceOf(DiagnoseError);
  return (thrown as DiagnoseError).code;
}

describe("diagnoseBake error classification", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("maps a plain 429 to RATE_LIMITED", async () => {
    expect(await codeFor(apiCallError(429))).toBe("RATE_LIMITED");
  });

  it("maps a 429 wrapped in the SDK's retry error to RATE_LIMITED", async () => {
    expect(await codeFor(retryError(apiCallError(429)))).toBe("RATE_LIMITED");
  });

  it("keeps other retried failures as AI_UNAVAILABLE", async () => {
    expect(await codeFor(retryError(apiCallError(500)))).toBe("AI_UNAVAILABLE");
  });

  it("maps unknown failures to AI_UNAVAILABLE", async () => {
    expect(await codeFor(new Error("boom"))).toBe("AI_UNAVAILABLE");
  });
});
