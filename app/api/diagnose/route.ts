import { NextResponse } from "next/server";
import {
  DiagnoseError,
  type DiagnoseErrorCode,
  diagnoseBake,
} from "@/lib/ai/diagnose";
import { diagnosisInputSchema } from "@/lib/ai/schema";
import { checkRateLimit } from "@/lib/rate-limit";

type ApiErrorCode = "INVALID_INPUT" | DiagnoseErrorCode;

// Last model called, for the evals; the client ignores it.
const MODEL_HEADER = "X-BakeFix-Model";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = await checkRateLimit(ip);

  if (!allowed) {
    return errorResponse(
      "RATE_LIMITED",
      "Too many diagnoses in a short time. Please wait a minute and try again.",
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "INVALID_INPUT",
      "The request body must be valid JSON.",
      400,
    );
  }

  const parsed = diagnosisInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "INVALID_INPUT",
      "The submitted problem could not be validated.",
      400,
    );
  }

  try {
    const { diagnosis, model } = await diagnoseBake(parsed.data);
    return NextResponse.json(
      { ok: true, diagnosis },
      { headers: { [MODEL_HEADER]: model } },
    );
  } catch (error) {
    if (error instanceof DiagnoseError) {
      const status = error.code === "RATE_LIMITED" ? 429 : 502;
      return errorResponse(error.code, error.message, status, error.model);
    }

    console.error("POST /api/diagnose: unexpected failure", error);
    return errorResponse(
      "AI_UNAVAILABLE",
      "The diagnosis service is unavailable right now. Please try again.",
      502,
    );
  }
}

function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  model: string | null = null,
) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: model ? { [MODEL_HEADER]: model } : undefined },
  );
}
