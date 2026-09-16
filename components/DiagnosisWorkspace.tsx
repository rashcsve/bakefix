"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { DiagnosisCard } from "@/components/diagnosis/DiagnosisCard";
import { DiagnosisErrorState } from "@/components/diagnosis/DiagnosisErrorState";
import { DiagnosisLoadingState } from "@/components/diagnosis/DiagnosisLoadingState";
import { BakeForm } from "@/components/form/BakeForm";
import { exampleDiagnosis } from "@/lib/ai/fixtures";
import {
  type Diagnosis,
  type DiagnosisInput,
  diagnosisInputSchema,
} from "@/lib/ai/schema";
import { mockDiagnose } from "@/lib/mock-diagnose";

type DiagnosisStatus = "example" | "loading" | "success" | "error";

export function DiagnosisWorkspace() {
  // react-hook-form mutates a stable object in place, which the React Compiler misreads as unchanged.
  "use no memo";

  const methods = useForm<DiagnosisInput>({
    resolver: zodResolver(diagnosisInputSchema),
    defaultValues: {
      category: "" as DiagnosisInput["category"],
      problem: "",
      recipe: "",
      technicalDetails: "",
      constraints: [],
    },
  });
  const [status, setStatus] = useState<DiagnosisStatus>("example");
  const [diagnosis, setDiagnosis] = useState<Diagnosis>(exampleDiagnosis);

  async function submitDiagnosis(values: DiagnosisInput) {
    setStatus("loading");
    try {
      const result = await mockDiagnose(values);
      setDiagnosis(result);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const handleFormSubmit = methods.handleSubmit(submitDiagnosis);

  return (
    <FormProvider {...methods}>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <BakeForm
          onSubmit={handleFormSubmit}
          isSubmitting={status === "loading"}
        />

        <div className="flex flex-col gap-8">
          {status === "loading" ? <DiagnosisLoadingState /> : null}
          {status === "error" ? (
            <DiagnosisErrorState onRetry={handleFormSubmit} />
          ) : null}
          {status === "example" || status === "success" ? (
            <section aria-labelledby="diagnosis-heading">
              <DiagnosisCard diagnosis={diagnosis} />
            </section>
          ) : null}
        </div>
      </div>
    </FormProvider>
  );
}
