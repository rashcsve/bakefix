import { NextResponse } from "next/server";
import {
  DiagnoseError,
  type DiagnoseErrorCode,
  diagnoseBake,
} from "@/lib/ai/diagnose";
import { diagnosisInputSchema } from "@/lib/ai/schema";

type ApiErrorCode = "INVALID_INPUT" | DiagnoseErrorCode;

export async function POST(request: Request) {
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
    const diagnosis = await diagnoseBake(parsed.data);
    return NextResponse.json({ ok: true, diagnosis });
  } catch (error) {
    if (error instanceof DiagnoseError) {
      const status = error.code === "RATE_LIMITED" ? 429 : 502;
      return errorResponse(error.code, error.message, status);
    }

    console.error("POST /api/diagnose: unexpected failure", error);
    return errorResponse(
      "AI_UNAVAILABLE",
      "The diagnosis service is unavailable right now. Please try again.",
      502,
    );
  }
}

function errorResponse(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}
