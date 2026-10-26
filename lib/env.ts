import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
});

export function getEnv() {
  return envSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
}

const rateLimitEnvSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.url("UPSTASH_REDIS_REST_URL must be a URL"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
});

// Rate limiting is optional: null when neither var is set, an error when only one is.
export function getRateLimitEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) {
    return null;
  }

  return rateLimitEnvSchema.parse({
    UPSTASH_REDIS_REST_URL: url,
    UPSTASH_REDIS_REST_TOKEN: token,
  });
}
