import { describe, expect, it } from "vitest";
import { diagnosisInputSchema, diagnosisSchema } from "@/lib/ai/schema";

const validInput = {
  category: "Cookies",
  problem: "My cookies spread into thin, flat puddles in the oven.",
  constraints: [],
};

const validDiagnosis = {
  headline: "Butter was too warm before baking",
  explanation: "Softened butter spreads before the dough sets.",
  confidence: "medium",
  causes: ["Butter was too warm when the dough was mixed."],
  rescueSteps: ["Chill the remaining dough before baking the next batch."],
  nextTime: ["Chill the dough for at least 30 minutes before baking."],
  missingInformation: [],
  safetyNote: null,
};

describe("diagnosisInputSchema", () => {
  it("accepts a full, valid input", () => {
    const result = diagnosisInputSchema.safeParse({
      ...validInput,
      recipe: "200g butter, 200g sugar, 300g flour",
      technicalDetails: "Baked at 180C on a dark sheet pan",
      constraints: ["Dairy-free"],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a minimal, valid input with only required fields", () => {
    const result = diagnosisInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("rejects a missing category", () => {
    const { category, ...rest } = validInput;
    const result = diagnosisInputSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects a problem shorter than 10 characters", () => {
    const result = diagnosisInputSchema.safeParse({
      ...validInput,
      problem: "too short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a problem longer than 1000 characters", () => {
    const result = diagnosisInputSchema.safeParse({
      ...validInput,
      problem: "a".repeat(1001),
    });

    expect(result.success).toBe(false);
  });

  it("rejects a recipe longer than 5000 characters", () => {
    const result = diagnosisInputSchema.safeParse({
      ...validInput,
      recipe: "a".repeat(5001),
    });

    expect(result.success).toBe(false);
  });

  it("rejects technical details longer than 1000 characters", () => {
    const result = diagnosisInputSchema.safeParse({
      ...validInput,
      technicalDetails: "a".repeat(1001),
    });

    expect(result.success).toBe(false);
  });

  it("rejects a constraint outside the supported set", () => {
    const result = diagnosisInputSchema.safeParse({
      ...validInput,
      constraints: ["Nut-free"],
    });

    expect(result.success).toBe(false);
  });
});

describe("diagnosisSchema", () => {
  it("accepts a full, valid diagnosis", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      safetyNote: "Discard any custard left unrefrigerated for over 2 hours.",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a null safetyNote", () => {
    const result = diagnosisSchema.safeParse(validDiagnosis);

    expect(result.success).toBe(true);
  });

  it("rejects zero causes", () => {
    const result = diagnosisSchema.safeParse({ ...validDiagnosis, causes: [] });

    expect(result.success).toBe(false);
  });

  it("rejects more than three causes", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      causes: ["a", "b", "c", "d"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported confidence value", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      confidence: "certain",
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than five nextTime recommendations", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      nextTime: ["a", "b", "c", "d", "e", "f"],
    });

    expect(result.success).toBe(false);
  });
});
