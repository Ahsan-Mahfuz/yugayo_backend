import { z } from "zod";

const symptomEnum = z.enum([
  "Bloating", "Abdominal Pain", "Nausea", "Constipation",
  "Heartburn", "Gas", "Fatigue", "Acid Reflux", "Cramps", "Diarrhea",
]);

const severityEnum = z.enum(["Mild", "Moderate", "Severe"]);

export const symptomLogSchema = z.object({
  symptoms: z
    .array(symptomEnum)
    .min(1, "Select at least one symptom"),
  severity: severityEnum,
  note:      z.string().max(500).trim().optional(),
  loggedAt:  z.string().optional(), // ISO datetime
});