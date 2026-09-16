import { describe, expect, it } from "vitest";
import { exampleDiagnosis } from "@/lib/ai/fixtures";
import { diagnosisSchema } from "@/lib/ai/schema";

describe("exampleDiagnosis fixture", () => {
  it("conforms to diagnosisSchema", () => {
    const result = diagnosisSchema.safeParse(exampleDiagnosis);

    expect(result.success).toBe(true);
  });
});
