import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  APICallError,
  generateText,
  NoOutputGeneratedError,
  Output,
  RetryError,
} from "ai";
import { z } from "zod";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import {
  type Diagnosis,
  type DiagnosisInput,
  diagnosisSchema,
} from "@/lib/ai/schema";
import { getEnv } from "@/lib/env";

const MODEL_NAME = "gemini-3.6-flash";
// Tried once when MODEL_NAME is overloaded (503) or runs out of its own time;
// on separate capacity.
const FALLBACK_MODEL_NAME = "gemini-3.5-flash-lite";
// Overall deadline for both models. Keep below lib/diagnose-client.ts's
// timeout so this error wins the race.
const REQUEST_TIMEOUT_MS = 20_000;
// The primary's share of REQUEST_TIMEOUT_MS; the fallback gets what is left.
const PRIMARY_TIMEOUT_MS = 13_000;
// Thinking models count hidden reasoning tokens toward this cap, so a tight
// limit truncates the JSON and shows up as INVALID_OUTPUT.
const MAX_OUTPUT_TOKENS = 4096;

export type DiagnoseErrorCode =
  | "AI_UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "RATE_LIMITED";

export class DiagnoseError extends Error {
  readonly code: DiagnoseErrorCode;

  constructor(code: DiagnoseErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function hasStatus(error: unknown, statusCode: number): boolean {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(cause) && cause.statusCode === statusCode;
}

function isRateLimited(error: unknown): boolean {
  return hasStatus(error, 429);
}

function isOverloaded(error: unknown): boolean {
  return hasStatus(error, 503);
}

function isNotFound(error: unknown): boolean {
  return hasStatus(error, 404);
}

export async function diagnoseBake(input: DiagnosisInput): Promise<Diagnosis> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    console.error("diagnoseBake: Gemini is not configured", error);
    throw new DiagnoseError(
      "AI_UNAVAILABLE",
      "The diagnosis service is not configured.",
    );
  }

  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const primaryTimeout = AbortSignal.timeout(PRIMARY_TIMEOUT_MS);
  const generate = (modelName: string, abortSignal: AbortSignal) =>
    generateText({
      model: google(modelName),
      output: Output.object({ schema: diagnosisSchema }),
      instructions: SYSTEM_PROMPT,
      prompt: buildUserMessage(input),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal,
    });

  let modelName = MODEL_NAME;
  try {
    let result: Awaited<ReturnType<typeof generate>>;
    try {
      result = await generate(
        MODEL_NAME,
        AbortSignal.any([primaryTimeout, deadline]),
      );
    } catch (error) {
      // Check the signals, not the error: the SDK may wrap the abort.
      const timedOut = primaryTimeout.aborted && !deadline.aborted;
      if (!isOverloaded(error) && !timedOut) throw error;

      console.error(
        `diagnoseBake: ${MODEL_NAME} ${timedOut ? "timed out" : "overloaded"}, trying ${FALLBACK_MODEL_NAME}`,
      );
      modelName = FALLBACK_MODEL_NAME;
      result = await generate(FALLBACK_MODEL_NAME, deadline);
    }

    return diagnosisSchema.parse(result.output);
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      NoOutputGeneratedError.isInstance(error)
    ) {
      console.error(
        "diagnoseBake: model output failed schema validation",
        error,
      );
      throw new DiagnoseError(
        "INVALID_OUTPUT",
        "The diagnosis service returned an unexpected response.",
      );
    }

    if (isRateLimited(error)) {
      console.error("diagnoseBake: rate limited by the model provider");
      throw new DiagnoseError(
        "RATE_LIMITED",
        "The diagnosis service is busy right now. Please try again shortly.",
      );
    }

    if (isNotFound(error)) {
      console.error(`diagnoseBake: ${modelName} not found; it may be retired`);
    }

    console.error(
      "diagnoseBake: model provider call failed",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    throw new DiagnoseError(
      "AI_UNAVAILABLE",
      "The diagnosis service is unavailable right now. Please try again.",
    );
  }
}
