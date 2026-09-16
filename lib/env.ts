import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
});

export function getEnv() {
  return envSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
}
