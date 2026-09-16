import {
  type Diagnosis,
  type DiagnosisInput,
  diagnosisSchema,
} from "@/lib/ai/schema";
import { isRecord } from "@/lib/type-guards";

// Keep above lib/ai/diagnose.ts's timeout so its error wins the race.
const REQUEST_TIMEOUT_MS = 25_000;
const GENERIC_ERROR_MESSAGE =
  "The diagnosis service returned an unexpected response.";

export class DiagnoseRequestError extends Error {}

export async function requestDiagnosis(
  input: DiagnosisInput,
): Promise<Diagnosis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch {
    throw new DiagnoseRequestError(
      "Could not reach the diagnosis service. Check your connection.",
    );
  } finally {
    clearTimeout(timeout);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DiagnoseRequestError(GENERIC_ERROR_MESSAGE);
  }

  const record = isRecord(payload) ? payload : {};

  if (!response.ok || record.ok !== true) {
    const message =
      typeof record.message === "string"
        ? record.message
        : GENERIC_ERROR_MESSAGE;
    throw new DiagnoseRequestError(message);
  }

  const result = diagnosisSchema.safeParse(record.diagnosis);
  if (!result.success) {
    throw new DiagnoseRequestError(GENERIC_ERROR_MESSAGE);
  }

  return result.data;
}
