import { APICallError, NoOutputGeneratedError, RetryError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

import { generateText } from "ai";
import { DiagnoseError, diagnoseBake } from "@/lib/ai/diagnose";
import { exampleDiagnosis } from "@/lib/ai/fixtures";
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

// diagnoseBake reads only `output`; cast the partial result to the mock's type.
function generated(output: unknown) {
  return { output } as Awaited<ReturnType<typeof generateText>>;
}

function calledModels() {
  return vi
    .mocked(generateText)
    .mock.calls.map(
      ([options]) => (options.model as { modelId: string }).modelId,
    );
}

async function codeFor(error: unknown) {
  vi.mocked(generateText).mockRejectedValueOnce(error);
  const thrown = await diagnoseBake(input).catch((e: unknown) => e);
  expect(thrown).toBeInstanceOf(DiagnoseError);
  return (thrown as DiagnoseError).code;
}

describe("diagnoseBake error classification", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
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

  it("maps a missing output to INVALID_OUTPUT", async () => {
    expect(await codeFor(new NoOutputGeneratedError())).toBe("INVALID_OUTPUT");
  });

  it("maps output that fails the schema to INVALID_OUTPUT", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      generated({ headline: "only a headline" }),
    );
    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("INVALID_OUTPUT");
  });

  it("maps a missing API key to AI_UNAVAILABLE without calling the model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("AI_UNAVAILABLE");
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("diagnoseBake model calls", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the diagnosis from a single call to the primary model", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(generated(exampleDiagnosis));

    await expect(diagnoseBake(input)).resolves.toEqual(exampleDiagnosis);
    expect(calledModels()).toEqual(["gemini-3.6-flash"]);
  });

  it("does not try another model when the primary is rate limited", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(
      retryError(apiCallError(429)),
    );

    await diagnoseBake(input).catch(() => {});
    expect(calledModels()).toEqual(["gemini-3.6-flash"]);
  });
});

describe("diagnoseBake fallback model", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers from the fallback model when the primary is overloaded", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await expect(diagnoseBake(input)).resolves.toEqual(exampleDiagnosis);
    expect(calledModels()).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("falls back when the overload is wrapped in the SDK's retry error", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(retryError(apiCallError(503)))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await expect(diagnoseBake(input)).resolves.toEqual(exampleDiagnosis);
  });

  it("maps an overloaded fallback to AI_UNAVAILABLE", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockRejectedValueOnce(apiCallError(503));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("AI_UNAVAILABLE");
  });

  it("maps a rate-limited fallback to RATE_LIMITED", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockRejectedValueOnce(apiCallError(429));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("RATE_LIMITED");
  });

  it.each([
    ["invalid output", new NoOutputGeneratedError()],
    ["a timeout", new DOMException("timed out", "TimeoutError")],
    ["a server error", apiCallError(500)],
  ])("does not fall back after %s", async (_, error) => {
    vi.mocked(generateText).mockRejectedValueOnce(error);

    await diagnoseBake(input).catch(() => {});
    expect(calledModels()).toEqual(["gemini-3.6-flash"]);
  });

  // Both calls must fit the one 20s server budget, which stays below the
  // client's 25s timeout; SDK retries would spend that budget on one model.
  it("shares one abort signal and disables SDK retries on both calls", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const [[primary], [fallback]] = vi.mocked(generateText).mock.calls;
    expect(primary.maxRetries).toBe(0);
    expect(fallback.maxRetries).toBe(0);
    expect(primary.abortSignal).toBeInstanceOf(AbortSignal);
    expect(fallback.abortSignal).toBe(primary.abortSignal);
  });
});
