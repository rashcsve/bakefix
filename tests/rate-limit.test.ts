// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upstash = vi.hoisted(() => ({
  limit: vi.fn(),
  constructed: vi.fn(),
  slidingWindow: vi.fn(() => "sliding-window"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({
  Redis: class {},
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = upstash.slidingWindow;
    limit = upstash.limit;
    constructor(options: unknown) {
      upstash.constructed(options);
    }
  },
}));

// The limiter is cached per module, so each test loads a fresh copy.
async function loadCheckRateLimit() {
  vi.resetModules();
  return (await import("@/lib/rate-limit")).checkRateLimit;
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    upstash.limit.mockReset();
    upstash.constructed.mockReset();
    upstash.slidingWindow.mockClear();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows a request under the limit, keyed by IP", async () => {
    upstash.limit.mockResolvedValueOnce({ success: true });
    const checkRateLimit = await loadCheckRateLimit();

    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(upstash.limit).toHaveBeenCalledWith("203.0.113.7");
    expect(upstash.slidingWindow).toHaveBeenCalledWith(5, "60 s");
    expect(upstash.constructed).toHaveBeenCalledWith(
      expect.objectContaining({
        limiter: "sliding-window",
        prefix: "bakefix:diagnose",
      }),
    );
  });

  it("blocks a request over the limit", async () => {
    upstash.limit.mockResolvedValueOnce({ success: false });
    const checkRateLimit = await loadCheckRateLimit();

    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: false });
  });

  it("allows and warns once when the Upstash vars are missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    const checkRateLimit = await loadCheckRateLimit();

    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(upstash.constructed).not.toHaveBeenCalled();
  });

  it("allows and logs once when only one Upstash var is set", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    const checkRateLimit = await loadCheckRateLimit();

    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(upstash.constructed).not.toHaveBeenCalled();
  });

  it("allows and logs when Redis throws", async () => {
    upstash.limit.mockRejectedValueOnce(new Error("connection refused"));
    const checkRateLimit = await loadCheckRateLimit();

    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(console.error).toHaveBeenCalled();
  });

  it("allows and logs when Redis times out", async () => {
    upstash.limit.mockResolvedValueOnce({ success: true, reason: "timeout" });
    const checkRateLimit = await loadCheckRateLimit();

    expect(await checkRateLimit("203.0.113.7")).toEqual({ allowed: true });
    expect(console.error).toHaveBeenCalled();
  });
});
