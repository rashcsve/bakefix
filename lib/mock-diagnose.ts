import type { Diagnosis } from "@/components/diagnosis/DiagnosisCard";
import { exampleDiagnosis } from "@/lib/example-diagnosis";
import type { BakeFormValues } from "@/lib/schemas/bake-form";

const MOCK_DIAGNOSIS_DELAY_MS = 1400;
const ERROR_TRIGGER_PHRASE = "trigger error";

// Temporary stand-in for the real POST /api/diagnose call added in Step 05.
// Typing "trigger error" in the problem field deterministically exercises
// the error state during manual review.
export function mockDiagnose(values: BakeFormValues): Promise<Diagnosis> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (values.problem.toLowerCase().includes(ERROR_TRIGGER_PHRASE)) {
        reject(new Error("Mocked diagnosis failure"));
        return;
      }

      resolve({
        ...exampleDiagnosis,
        headline: `${values.category}: ${exampleDiagnosis.headline}`,
      });
    }, MOCK_DIAGNOSIS_DELAY_MS);
  });
}
