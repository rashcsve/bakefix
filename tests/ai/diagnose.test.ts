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
    vi.stubEnv("GROQ_API_KEY", "");
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
    vi.stubEnv("GROQ_API_KEY", "");
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

  // Was "does not try another model when the primary is rate limited": a
  // configured Groq key now gets a second call (docs/specs/groq-fallback.md).
  it("does not try another model when the primary is rate limited and Groq is not configured", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(
      retryError(apiCallError(429)),
    );

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("RATE_LIMITED");
    expect(calledModels()).toEqual(["gemini-3.6-flash"]);
  });
});

describe("diagnoseBake fallback model", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GROQ_API_KEY", "");
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
    [
      "a timeout neither deadline caused",
      new DOMException("timed out", "TimeoutError"),
    ],
    ["a server error", apiCallError(500)],
  ])("does not fall back after %s", async (_, error) => {
    vi.mocked(generateText).mockRejectedValueOnce(error);

    await diagnoseBake(input).catch(() => {});
    expect(calledModels()).toEqual(["gemini-3.6-flash"]);
  });

  // Both calls must fit the 20s server budget, which stays below the client's
  // 25s timeout; SDK retries would spend that budget on one model.
  it("disables SDK retries on both calls", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const [[primary], [fallback]] = vi.mocked(generateText).mock.calls;
    expect(primary.maxRetries).toBe(0);
    expect(fallback.maxRetries).toBe(0);
  });

  it("caps output at 4096 tokens on both calls", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const [[primary], [fallback]] = vi.mocked(generateText).mock.calls;
    expect(primary.maxOutputTokens).toBe(4096);
    expect(fallback.maxOutputTokens).toBe(4096);
  });
});

// AbortSignal.timeout runs on Node's internal timers, which fake timers don't
// reach, so the tests hand out signals they fire by hand, keyed by duration.
const timeouts = new Map<number, AbortController>();

function controlTimeouts() {
  timeouts.clear();
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    timeouts.set(ms, controller);
    return controller.signal;
  });
}

function fireTimeout(ms: number) {
  const controller = timeouts.get(ms);
  if (!controller) throw new Error(`no ${ms}ms timeout was created`);
  controller.abort(new DOMException("timed out", "TimeoutError"));
}

function timeOutAfter(ms: number) {
  return async (): Promise<never> => {
    fireTimeout(ms);
    throw new DOMException("timed out", "TimeoutError");
  };
}

function loggedErrors() {
  return vi.mocked(console.error).mock.calls.flat().map(String).join("\n");
}

describe("diagnoseBake timeouts", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    controlTimeouts();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("gives the primary 13s inside a 20s overall deadline", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const [[primary], [fallback]] = vi.mocked(generateText).mock.calls;

    fireTimeout(13_000);
    expect(primary.abortSignal?.aborted).toBe(true);
    expect(fallback.abortSignal?.aborted).toBe(false);

    fireTimeout(20_000);
    expect(fallback.abortSignal?.aborted).toBe(true);
  });

  // Was the characterization test "maps a primary timeout to AI_UNAVAILABLE
  // without trying the fallback": the primary now has its own 13s.
  it("answers from the fallback model when the primary's 13s runs out", async () => {
    vi.mocked(generateText)
      .mockImplementationOnce(timeOutAfter(13_000))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await expect(diagnoseBake(input)).resolves.toEqual(exampleDiagnosis);
    expect(calledModels()).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("does not fall back once the overall 20s deadline has passed", async () => {
    vi.mocked(generateText).mockImplementationOnce(timeOutAfter(20_000));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("AI_UNAVAILABLE");
    expect(calledModels()).toEqual(["gemini-3.6-flash"]);
  });
});

describe("diagnoseBake retired models", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs the primary model as not found on a 404", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(apiCallError(404));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect(loggedErrors()).toMatch(/gemini-3\.6-flash.*not found/);
    expect((thrown as DiagnoseError).code).toBe("AI_UNAVAILABLE");
    expect((thrown as DiagnoseError).message).toBe(
      "The diagnosis service is unavailable right now. Please try again.",
    );
  });

  it("logs the fallback model as not found on a 404", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockRejectedValueOnce(retryError(apiCallError(404)));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect(loggedErrors()).toMatch(/gemini-3\.5-flash-lite.*not found/);
    expect((thrown as DiagnoseError).code).toBe("AI_UNAVAILABLE");
  });
});

describe("diagnoseBake Groq fallback", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(generateText).mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    controlTimeouts();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["a plain 429", apiCallError(429)],
    ["a 429 wrapped in the SDK's retry error", retryError(apiCallError(429))],
  ])("answers from Groq when the primary returns %s", async (_, error) => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await expect(diagnoseBake(input)).resolves.toEqual(exampleDiagnosis);
    expect(calledModels()).toEqual(["gemini-3.6-flash", "openai/gpt-oss-120b"]);
  });

  it("sends Groq the same request as the primary", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(429))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const [[primary], [groq]] = vi.mocked(generateText).mock.calls;
    expect(groq.instructions).toBe(primary.instructions);
    expect(groq.prompt).toBe(primary.prompt);
    expect(groq.maxOutputTokens).toBe(4096);
    expect(groq.maxRetries).toBe(0);
    expect(await groq.output?.responseFormat).toEqual(
      await primary.output?.responseFormat,
    );
  });

  it("bounds the Groq call by the overall 20s deadline", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(429))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const [, [groq]] = vi.mocked(generateText).mock.calls;

    fireTimeout(13_000);
    expect(groq.abortSignal?.aborted).toBe(false);

    fireTimeout(20_000);
    expect(groq.abortSignal?.aborted).toBe(true);
  });

  it("logs one line saying the primary was rate limited and Groq is tried", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(429))
      .mockResolvedValueOnce(generated(exampleDiagnosis));

    await diagnoseBake(input);
    const lines = vi
      .mocked(console.error)
      .mock.calls.map((args) => args.map(String).join(" "))
      .filter((line) =>
        /gemini-3\.6-flash rate limited.*openai\/gpt-oss-120b/.test(line),
      );
    expect(lines).toHaveLength(1);
  });

  it.each([
    ["a 429", "RATE_LIMITED", apiCallError(429)],
    ["a wrapped 429", "RATE_LIMITED", retryError(apiCallError(429))],
    ["a server error", "AI_UNAVAILABLE", apiCallError(500)],
    ["an unknown failure", "AI_UNAVAILABLE", new Error("boom")],
    ["a missing output", "INVALID_OUTPUT", new NoOutputGeneratedError()],
  ])("maps %s from Groq to %s", async (_, code, error) => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(429))
      .mockRejectedValueOnce(error);

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe(code);
    expect(calledModels()).toEqual(["gemini-3.6-flash", "openai/gpt-oss-120b"]);
  });

  it("maps Groq output that fails the schema to INVALID_OUTPUT", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(429))
      .mockResolvedValueOnce(generated({ headline: "only a headline" }));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("INVALID_OUTPUT");
  });

  it("logs the Groq model as not found on a 404", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(429))
      .mockRejectedValueOnce(apiCallError(404));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect(loggedErrors()).toMatch(/openai\/gpt-oss-120b.*not found/);
    expect((thrown as DiagnoseError).code).toBe("AI_UNAVAILABLE");
  });

  it("does not call Groq when the Gemini fallback is rate limited after an overload", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(apiCallError(503))
      .mockRejectedValueOnce(apiCallError(429));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("RATE_LIMITED");
    expect(calledModels()).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("does not call Groq when the Gemini fallback is rate limited after a timeout", async () => {
    vi.mocked(generateText)
      .mockImplementationOnce(timeOutAfter(13_000))
      .mockRejectedValueOnce(apiCallError(429));

    const thrown = await diagnoseBake(input).catch((e: unknown) => e);
    expect((thrown as DiagnoseError).code).toBe("RATE_LIMITED");
    expect(calledModels()).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ]);
  });
});
