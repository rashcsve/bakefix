import type { Diagnosis } from "@/components/diagnosis/DiagnosisCard";

export const exampleDiagnosis: Diagnosis = {
  headline: "Your pastry cream likely undercooked the egg yolks",
  explanation:
    "The custard base didn't reach a high enough temperature to activate the egg proteins and starch, leaving it thin and tasting raw.",
  confidence: "medium",
  causes: [
    "The mixture was removed from heat before reaching a full boil, so the cornstarch never fully gelatinized.",
    "Tempering was rushed, so the yolks scrambled slightly instead of thickening smoothly.",
    "Too little starch relative to the amount of liquid for this batch size.",
  ],
  rescueSteps: [
    "Return the custard to low heat, whisking constantly, until it thickens and holds a visible boil for about 30 seconds.",
    "Strain through a fine sieve to remove any scrambled bits before chilling.",
  ],
  nextTime: [
    "Bring the base to a full rolling boil for at least 30 seconds to fully activate the starch.",
    "Temper the yolks gradually with small additions of hot liquid before combining.",
    "Weigh ingredients rather than using volume measures for a consistent starch ratio.",
  ],
  missingInformation: [
    "Final temperature the custard reached",
    "Type and amount of starch used",
  ],
  safetyNote:
    "Undercooked egg-based custards should not be served past a light chill if they never reached a safe thickening temperature. Reheat fully before serving, or discard if left at room temperature too long.",
};
