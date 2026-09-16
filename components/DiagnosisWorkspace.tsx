"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { DiagnosisCard } from "@/components/diagnosis/DiagnosisCard";
import { DiagnosisEmptyState } from "@/components/diagnosis/DiagnosisEmptyState";
import { DiagnosisErrorState } from "@/components/diagnosis/DiagnosisErrorState";
import { DiagnosisLoadingState } from "@/components/diagnosis/DiagnosisLoadingState";
import { BakeForm } from "@/components/form/BakeForm";
import {
  type Diagnosis,
  type DiagnosisInput,
  diagnosisInputSchema,
} from "@/lib/ai/schema";
import { DiagnoseRequestError, requestDiagnosis } from "@/lib/diagnose-client";

type DiagnosisStatus = "idle" | "loading" | "success" | "error";

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
  const [status, setStatus] = useState<DiagnosisStatus>("idle");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status === "success") {
      headingRef.current?.focus();
    }
  }, [status]);

  async function submitDiagnosis(values: DiagnosisInput) {
    setStatus("loading");
    try {
      const result = await requestDiagnosis(values);
      setDiagnosis(result);
      setStatus("success");
    } catch (error) {
      setErrorMessage(
        error instanceof DiagnoseRequestError ? error.message : undefined,
      );
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
          {status === "idle" ? <DiagnosisEmptyState /> : null}
          {status === "loading" ? <DiagnosisLoadingState /> : null}
          {status === "error" ? (
            <DiagnosisErrorState
              onRetry={handleFormSubmit}
              message={errorMessage}
            />
          ) : null}
          {status === "success" && diagnosis ? (
            <section aria-labelledby="diagnosis-heading">
              <DiagnosisCard diagnosis={diagnosis} headingRef={headingRef} />
            </section>
          ) : null}
        </div>
      </div>
    </FormProvider>
  );
}
