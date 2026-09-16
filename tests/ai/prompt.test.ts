import { describe, expect, it } from "vitest";
import { buildUserMessage } from "@/lib/ai/prompt";
import type { DiagnosisInput } from "@/lib/ai/schema";

const baseInput: DiagnosisInput = {
  category: "Choux",
  problem:
    "My choux pastry collapsed a few minutes after coming out of the oven.",
  constraints: [],
};

describe("buildUserMessage", () => {
  it("includes only the required fields when recipe, technical details, and constraints are absent", () => {
    const message = buildUserMessage(baseInput);

    expect(message).toContain("Category: Choux");
    expect(message).toContain(`Problem: ${baseInput.problem}`);
    expect(message).not.toContain("Recipe:");
    expect(message).not.toContain("Technical details:");
    expect(message).not.toContain("Dietary constraints:");
  });

  it("includes the recipe when provided", () => {
    const message = buildUserMessage({
      ...baseInput,
      recipe: "125g butter, 125g water, 150g flour, 4 eggs",
    });

    expect(message).toContain(
      "Recipe:\n125g butter, 125g water, 150g flour, 4 eggs",
    );
  });

  it("includes technical details when provided", () => {
    const message = buildUserMessage({
      ...baseInput,
      technicalDetails: "Baked at 200C, oven door opened at minute 15",
    });

    expect(message).toContain(
      "Technical details: Baked at 200C, oven door opened at minute 15",
    );
  });

  it("includes dietary constraints when provided", () => {
    const message = buildUserMessage({
      ...baseInput,
      constraints: ["Dairy-free", "Gluten-free"],
    });

    expect(message).toContain("Dietary constraints: Dairy-free, Gluten-free");
  });
});
