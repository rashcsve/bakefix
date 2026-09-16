import { z } from "zod";
import { DIETARY_CONSTRAINTS } from "@/lib/constants";

export const bakeFormSchema = z.object({
  category: z.string().min(1, "Select a pastry category."),
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
  technicalDetails: z.string().trim().optional(),
  constraints: z
    .array(z.enum(DIETARY_CONSTRAINTS))
    .max(3, "Select up to three dietary constraints."),
});

export type BakeFormValues = z.infer<typeof bakeFormSchema>;
