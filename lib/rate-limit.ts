import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getRateLimitEnv } from "@/lib/env";

// Ratelimit allows the request once this passes
const REDIS_TIMEOUT_MS = 1_500;

// undefined until first use, null when rate limiting is not configured.
let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) {
    return limiter;
  }

  let env: ReturnType<typeof getRateLimitEnv>;
  try {
    env = getRateLimitEnv();
  } catch (error) {
    // Cache the miss so a bad config logs once instead of on every request.
    console.error(
      "Rate limiting is off: the Upstash config is invalid.",
      error,
    );
    limiter = null;
    return limiter;
  }

  if (env === null) {
    console.warn(
      "Rate limiting is off: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set.",
    );
    limiter = null;
    return limiter;
  }

  limiter = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "bakefix:diagnose",
    timeout: REDIS_TIMEOUT_MS,
  });

  return limiter;
}

// Fails open: a missing or broken limiter must never block a diagnosis.
export async function checkRateLimit(
  ip: string,
): Promise<{ allowed: boolean }> {
  try {
    const ratelimit = getLimiter();

    if (ratelimit === null) {
      return { allowed: true };
    }

    const { success, reason } = await ratelimit.limit(ip);
    if (reason === "timeout") {
      console.error("checkRateLimit: Redis timed out, allowing the request");
    }

    return { allowed: success };
  } catch (error) {
    console.error(
      "checkRateLimit: limiter failed, allowing the request",
      error,
    );
    return { allowed: true };
  }
}
