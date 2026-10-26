// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/diagnose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/diagnose")>()),
  diagnoseBake: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { POST } from "@/app/api/diagnose/route";
import { DiagnoseError, diagnoseBake } from "@/lib/ai/diagnose";
import { exampleDiagnosis } from "@/lib/ai/fixtures";
import type { DiagnosisInput } from "@/lib/ai/schema";
import { checkRateLimit } from "@/lib/rate-limit";

const input: DiagnosisInput = {
  category: "Cookies",
  problem: "My cookies spread into thin flat puddles.",
  constraints: [],
};

function post(body: string, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    }),
  );
}

describe("POST /api/diagnose", () => {
  beforeEach(() => {
    // restoreAllMocks leaves queued *Once values on the module mock.
    vi.mocked(diagnoseBake).mockReset();
    vi.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a body that is not JSON with 400 INVALID_INPUT", async () => {
    const response = await post("{not json");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(diagnoseBake).not.toHaveBeenCalled();
  });

  it("rejects a body that fails the schema with 400 INVALID_INPUT", async () => {
    const response = await post(JSON.stringify({ category: "Cookies" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(diagnoseBake).not.toHaveBeenCalled();
  });

  it("returns the diagnosis on success", async () => {
    vi.mocked(diagnoseBake).mockResolvedValueOnce(exampleDiagnosis);

    const response = await post(JSON.stringify(input));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      diagnosis: exampleDiagnosis,
    });
  });

  it("maps a RATE_LIMITED DiagnoseError to 429 with its message", async () => {
    vi.mocked(diagnoseBake).mockRejectedValueOnce(
      new DiagnoseError("RATE_LIMITED", "Slow down."),
    );

    const response = await post(JSON.stringify(input));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Slow down.",
    });
  });

  it.each(["AI_UNAVAILABLE", "INVALID_OUTPUT"] as const)(
    "maps a %s DiagnoseError to 502 with its message",
    async (code) => {
      vi.mocked(diagnoseBake).mockRejectedValueOnce(
        new DiagnoseError(code, "Something went wrong."),
      );

      const response = await post(JSON.stringify(input));

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        ok: false,
        code,
        message: "Something went wrong.",
      });
    },
  );

  it("maps an unexpected error to 502 without leaking its message", async () => {
    vi.mocked(diagnoseBake).mockRejectedValueOnce(
      new Error("secret internal detail"),
    );

    const response = await post(JSON.stringify(input));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ ok: false, code: "AI_UNAVAILABLE" });
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
  });
});

describe("POST /api/diagnose rate limiting", () => {
  beforeEach(() => {
    vi.mocked(diagnoseBake).mockReset();
    vi.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 429 RATE_LIMITED when the IP is over the limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false });

    const response = await post(JSON.stringify(input));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message:
        "Too many diagnoses in a short time. Please wait a minute and try again.",
    });
    expect(diagnoseBake).not.toHaveBeenCalled();
  });

  it("checks the limit before parsing the body", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false });

    const response = await post("{not json");

    expect(response.status).toBe(429);
  });

  it("keys the limit by the first x-forwarded-for entry", async () => {
    vi.mocked(diagnoseBake).mockResolvedValueOnce(exampleDiagnosis);

    const response = await post(JSON.stringify(input), {
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
    });

    expect(response.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledWith("203.0.113.7");
  });

  it('falls back to "unknown" without x-forwarded-for', async () => {
    vi.mocked(diagnoseBake).mockResolvedValueOnce(exampleDiagnosis);

    await post(JSON.stringify(input));

    expect(checkRateLimit).toHaveBeenCalledWith("unknown");
  });
});
