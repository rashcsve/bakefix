import { describe, expect, it } from "vitest";
import { diagnosisSchema } from "@/lib/ai/schema";
import { isRecord } from "@/lib/type-guards";
import { evalCases } from "./cases";

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

function diagnosisText(diagnosis: {
  headline: string;
  explanation: string;
  causes: string[];
  rescueSteps: string[];
  nextTime: string[];
  missingInformation: string[];
  safetyNote: string | null;
}): string {
  return [
    diagnosis.headline,
    diagnosis.explanation,
    ...diagnosis.causes,
    ...diagnosis.rescueSteps,
    ...diagnosis.nextTime,
    ...diagnosis.missingInformation,
    diagnosis.safetyNote ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

describe.skipIf(!hasApiKey)("pastry diagnosis evaluations", () => {
  for (const evalCase of evalCases) {
    it(evalCase.name, async () => {
      const response = await fetch(`${BASE_URL}/api/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evalCase.input),
      });
      const payload: unknown = await response.json();

      expect(
        response.ok,
        `Response was not ok: ${JSON.stringify(payload)}`,
      ).toBe(true);
      expect(
        isRecord(payload) && payload.ok,
        `Unexpected response shape: ${JSON.stringify(payload)}`,
      ).toBe(true);

      const parsed = diagnosisSchema.safeParse(
        isRecord(payload) ? payload.diagnosis : undefined,
      );
      expect(
        parsed.success,
        parsed.success ? undefined : JSON.stringify(parsed.error.issues),
      ).toBe(true);
      if (!parsed.success) {
        return;
      }

      const text = diagnosisText(parsed.data);
      if (evalCase.expectedConcepts.length > 0) {
        const matchedAny = evalCase.expectedConcepts.some((concept) =>
          text.includes(concept.toLowerCase()),
        );
        expect(
          matchedAny,
          `Expected one of [${evalCase.expectedConcepts.join(", ")}] in: ${text}`,
        ).toBe(true);
      }

      if (evalCase.expectMissingInformation) {
        expect(parsed.data.missingInformation.length).toBeGreaterThan(0);
      }
    }, 30_000);
  }
});
