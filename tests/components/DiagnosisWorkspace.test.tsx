import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosisWorkspace } from "@/components/DiagnosisWorkspace";
import type { Diagnosis } from "@/lib/ai/schema";
import { DiagnoseRequestError, requestDiagnosis } from "@/lib/diagnose-client";

vi.mock("@/lib/diagnose-client", () => {
  class DiagnoseRequestError extends Error {}
  return {
    DiagnoseRequestError,
    requestDiagnosis: vi.fn(),
  };
});

const mockRequestDiagnosis = vi.mocked(requestDiagnosis);

const mockDiagnosis: Diagnosis = {
  headline: "Butter was too warm before baking",
  explanation: "Softened butter spreads before the dough sets.",
  confidence: "medium",
  causes: ["Butter was too warm when the dough was mixed."],
  rescueSteps: ["Chill the remaining dough before baking the next batch."],
  nextTime: ["Chill the dough for at least 30 minutes before baking."],
  missingInformation: [],
  safetyNote: null,
};

const problemText =
  "My cookies spread into thin, flat puddles in the oven every time.";

function fillValidForm() {
  fireEvent.click(screen.getByRole("radio", { name: "Cookies" }));
  fireEvent.change(screen.getByLabelText("Describe what went wrong"), {
    target: { value: problemText },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Dairy-free" }));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /diagnose my bake/i }));
}

beforeEach(() => {
  mockRequestDiagnosis.mockReset();
});

describe("DiagnosisWorkspace", () => {
  it("shows the empty state before any submission", () => {
    render(<DiagnosisWorkspace />);

    expect(screen.getByText(/no diagnosis yet/i)).toBeInTheDocument();
  });

  it("does not submit an invalid form", async () => {
    render(<DiagnosisWorkspace />);

    submit();

    expect(
      await screen.findByText("Select a pastry category."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add a bit more detail (at least 10 characters)."),
    ).toBeInTheDocument();
    expect(mockRequestDiagnosis).not.toHaveBeenCalled();
    expect(screen.getByText(/no diagnosis yet/i)).toBeInTheDocument();
  });

  it("submits the selected category, problem, and constraints", async () => {
    mockRequestDiagnosis.mockResolvedValue(mockDiagnosis);
    render(<DiagnosisWorkspace />);

    fillValidForm();
    submit();

    await waitFor(() => expect(mockRequestDiagnosis).toHaveBeenCalledTimes(1));
    const submitted = mockRequestDiagnosis.mock.calls[0]?.[0];
    expect(submitted).toBeDefined();
    if (!submitted) {
      return;
    }
    expect(submitted.category).toBe("Cookies");
    expect(submitted.problem).toBe(problemText);
    expect(submitted.constraints).toEqual(["Dairy-free"]);
  });

  it("shows a loading state while the request is pending, then renders the result and moves focus to it", async () => {
    let resolveRequest!: (diagnosis: Diagnosis) => void;
    mockRequestDiagnosis.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(<DiagnosisWorkspace />);

    fillValidForm();
    submit();

    expect(await screen.findByRole("status")).toBeInTheDocument();

    resolveRequest(mockDiagnosis);

    const heading = await screen.findByRole("heading", {
      name: "Chef's diagnosis",
    });
    expect(
      screen.getByRole("heading", { name: mockDiagnosis.headline }),
    ).toBeInTheDocument();
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("preserves the entered input and shows the error message when the request fails", async () => {
    mockRequestDiagnosis.mockRejectedValue(
      new DiagnoseRequestError(
        "The diagnosis service is unavailable right now.",
      ),
    );
    render(<DiagnosisWorkspace />);

    fillValidForm();
    submit();

    expect(
      await screen.findByText(
        "The diagnosis service is unavailable right now.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Cookies" })).toBeChecked();
    expect(screen.getByLabelText("Describe what went wrong")).toHaveValue(
      problemText,
    );
    expect(screen.getByRole("checkbox", { name: "Dairy-free" })).toBeChecked();
  });
});
