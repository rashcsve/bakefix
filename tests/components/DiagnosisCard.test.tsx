import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosisCard } from "@/components/diagnosis/DiagnosisCard";
import type { Diagnosis } from "@/lib/ai/schema";

const repeated = "Chill the dough for at least 30 minutes.";

const diagnosisWithRepeats: Diagnosis = {
  headline: "Butter was too warm before baking",
  explanation: "Softened butter spreads before the dough sets.",
  confidence: "medium",
  causes: ["Butter was too warm.", "Butter was too warm."],
  rescueSteps: [repeated, repeated],
  nextTime: [repeated, repeated],
  missingInformation: [
    "Oven temperature",
    "Oven temperature#2",
    "Oven temperature",
  ],
  safetyNote: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DiagnosisCard", () => {
  it("shows repeated model output once per list without duplicate React keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<DiagnosisCard diagnosis={diagnosisWithRepeats} />);

    expect(screen.getAllByText("Butter was too warm.")).toHaveLength(1);
    expect(screen.getAllByText(repeated)).toHaveLength(2);
    expect(screen.getAllByText("Oven temperature")).toHaveLength(1);
    expect(screen.getByText("Oven temperature#2")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
