import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import {
  APICallError,
  generateText,
  type LanguageModel,
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
import { getEnv, getFallbackEnv } from "@/lib/env";

const MODEL_NAME = "gemini-3.6-flash";
// Used once if the primary returns 503 or times out.
const FALLBACK_MODEL_NAME = "gemini-3.5-flash-lite";
// Used once if the primary returns 429 and GROQ_API_KEY is set.
const GROQ_MODEL_NAME = "openai/gpt-oss-120b";
// Deadline for all calls. Must stay below the client timeout (25s).
const REQUEST_TIMEOUT_MS = 20_000;
// Primary's share of the deadline; the fallback gets the rest.
const PRIMARY_TIMEOUT_MS = 13_000;
// Includes reasoning tokens; too low truncates the JSON (INVALID_OUTPUT).
const MAX_OUTPUT_TOKENS = 4096;

export type DiagnoseErrorCode =
  | "AI_UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "RATE_LIMITED";

export type DiagnoseResult = { diagnosis: Diagnosis; model: string };

export class DiagnoseError extends Error {
  readonly code: DiagnoseErrorCode;
  // Last model called; null if none was (missing key).
  readonly model: string | null;

  constructor(code: DiagnoseErrorCode, message: string, model: string | null) {
    super(message);
    this.code = code;
    this.model = model;
  }
}

function apiCallCause(error: unknown): APICallError | null {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(cause) ? cause : null;
}

function hasStatus(error: unknown, statusCode: number): boolean {
  return apiCallCause(error)?.statusCode === statusCode;
}

// Strict JSON-schema mode rejects bad output with a 400. The SDK's Groq error
// schema drops `error.code`, so only the raw body names it.
function isSchemaRejection(error: unknown): boolean {
  const cause = apiCallCause(error);
  return (
    cause?.statusCode === 400 &&
    (cause.responseBody?.includes("json_validate_failed") ?? false)
  );
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

export async function diagnoseBake(
  input: DiagnosisInput,
): Promise<DiagnoseResult> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    console.error("diagnoseBake: Gemini is not configured", error);
    throw new DiagnoseError(
      "AI_UNAVAILABLE",
      "The diagnosis service is not configured.",
      null,
    );
  }

  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const primaryTimeout = AbortSignal.timeout(PRIMARY_TIMEOUT_MS);
  const generate = (model: LanguageModel, abortSignal: AbortSignal) =>
    generateText({
      model,
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
        google(MODEL_NAME),
        AbortSignal.any([primaryTimeout, deadline]),
      );
    } catch (error) {
      if (isRateLimited(error)) {
        const fallbackEnv = getFallbackEnv();
        if (!fallbackEnv) throw error;

        console.error(
          `diagnoseBake: ${MODEL_NAME} rate limited, trying ${GROQ_MODEL_NAME}`,
        );

        const groq = createGroq({ apiKey: fallbackEnv.GROQ_API_KEY });
        modelName = GROQ_MODEL_NAME;
        try {
          result = await generate(groq(GROQ_MODEL_NAME), deadline);
        } catch (groqError) {
          // Groq often goes one item over a list limit; a second try usually fits.
          if (!isSchemaRejection(groqError)) throw groqError;

          console.error(
            `diagnoseBake: ${GROQ_MODEL_NAME} output was over the schema limits, retrying once`,
          );
          result = await generate(groq(GROQ_MODEL_NAME), deadline);
        }
      } else {
        // Check the signals, not the error: the SDK may wrap the abort.
        const timedOut = primaryTimeout.aborted && !deadline.aborted;
        if (!isOverloaded(error) && !timedOut) throw error;

        console.error(
          `diagnoseBake: ${MODEL_NAME} ${timedOut ? "timed out" : "overloaded"}, trying ${FALLBACK_MODEL_NAME}`,
        );
        modelName = FALLBACK_MODEL_NAME;
        result = await generate(google(FALLBACK_MODEL_NAME), deadline);
      }
    }

    return {
      diagnosis: diagnosisSchema.parse(result.output),
      model: modelName,
    };
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      NoOutputGeneratedError.isInstance(error)
    ) {
      console.error(
        `diagnoseBake: ${modelName} output failed schema validation`,
        error,
      );
      throw new DiagnoseError(
        "INVALID_OUTPUT",
        "The diagnosis service returned an unexpected response.",
        modelName,
      );
    }

    if (isSchemaRejection(error)) {
      console.error(
        `diagnoseBake: ${modelName} output failed schema validation`,
        apiCallCause(error)?.message,
      );

      throw new DiagnoseError(
        "INVALID_OUTPUT",
        "The diagnosis service returned an unexpected response.",
        modelName,
      );
    }

    if (isRateLimited(error)) {
      console.error("diagnoseBake: rate limited by the model provider");
      throw new DiagnoseError(
        "RATE_LIMITED",
        "The diagnosis service is busy right now. Please try again shortly.",
        modelName,
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
      modelName,
    );
  }
}
