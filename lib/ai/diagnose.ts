import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, generateText, NoOutputGeneratedError, Output } from "ai";
import { z } from "zod";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import {
  type Diagnosis,
  type DiagnosisInput,
  diagnosisSchema,
} from "@/lib/ai/schema";
import { getEnv } from "@/lib/env";

const MODEL_NAME = "gemini-3.6-flash";
// Keep below lib/diagnose-client.ts's timeout so this error wins the race.
const REQUEST_TIMEOUT_MS = 20_000;

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

  try {
    const { output } = await generateText({
      model: google(MODEL_NAME),
      output: Output.object({ schema: diagnosisSchema }),
      instructions: SYSTEM_PROMPT,
      prompt: buildUserMessage(input),
      timeout: REQUEST_TIMEOUT_MS,
    });

    return diagnosisSchema.parse(output);
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

    if (APICallError.isInstance(error) && error.statusCode === 429) {
      console.error("diagnoseBake: rate limited by the model provider");
      throw new DiagnoseError(
        "RATE_LIMITED",
        "The diagnosis service is busy right now. Please try again shortly.",
      );
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
