import { z } from "zod";
import { DIETARY_CONSTRAINTS, PASTRY_CATEGORIES } from "@/lib/constants";

export const diagnosisInputSchema = z.object({
  category: z.enum(PASTRY_CATEGORIES, { message: "Select a pastry category." }),
  problem: z
    .string()
    .trim()
    .min(10, "Add a bit more detail (at least 10 characters).")
    .max(1000, "Keep the description under 1000 characters."),
  recipe: z
    .string()
    .trim()
    .max(5000, "Keep the recipe under 5000 characters.")
    .optional(),
  technicalDetails: z
    .string()
    .trim()
    .max(1000, "Keep technical details under 1000 characters.")
    .optional(),
  constraints: z
    .array(z.enum(DIETARY_CONSTRAINTS))
    .max(3, "Select up to three dietary constraints."),
});

export type DiagnosisInput = z.infer<typeof diagnosisInputSchema>;

export const diagnosisSchema = z.object({
  headline: z.string().min(1),
  explanation: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  causes: z.array(z.string().min(1)).min(1).max(3),
  rescueSteps: z.array(z.string().min(1)).max(4),
  nextTime: z.array(z.string().min(1)).min(1).max(5),
  missingInformation: z.array(z.string().min(1)).max(3),
  safetyNote: z.string().min(1).nullable(),
});

export type Diagnosis = z.infer<typeof diagnosisSchema>;
export type Confidence = Diagnosis["confidence"];
