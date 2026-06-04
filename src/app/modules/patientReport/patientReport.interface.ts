/**
 * Shape of the data used to render the downloadable EzyGut clinician report PDF.
 * Built by patientReport.service and consumed by patientReport.pdf.
 */

export interface IReportFlareRisk {
  /** "Low" | "Moderate" | "High" | "Unknown" */
  label: string;
  /** 0–100, or null when no meal-level food_score was stored. */
  score: number | null;
  /** Pre-formatted display string e.g. "Low - 22/100" or "—". */
  display: string;
}

export interface IReportFoodLogRow {
  dateTime: string; // "Jan 12, 8:15 AM"
  mealType: string; // Breakfast | Lunch | Dinner | Snack
  foods: string; // "Oats, banana"
  flareRisk: IReportFlareRisk;
}

export interface IReportSymptomRow {
  dateTime: string;
  symptom: string; // single symptom per row
  severity: string; // Mild | Moderate | Severe
}

export interface IReportAssociationRow {
  food: string;
  symptom: string;
  observedPattern: string; // "Associated 3 out of 4 times within about 2 hours"
  level: string; // High | Moderate | Early Signal
}

export interface IReportSafeFoodRow {
  food: string;
  timesLogged: number;
  symptomsAfter: string; // "None observed"
}

export interface IReportProgressRow {
  metric: string;
  current: string;
  previous: string;
}

export interface IReportData {
  generatedAt: Date;

  patient: {
    name: string;
    email: string;
  };

  period: {
    label: string; // "Last 7 Days" | "Last 30 Days"
    days: number;
  };

  summary: {
    gutBalance: string; // "68/100 - Moderate" or "N/A"
    totalMeals: number;
    totalSymptoms: number;
    mostCommonSymptom: string; // "Bloating" or "—"
    text: string;
  };

  foodLogs: IReportFoodLogRow[];
  symptomLogs: IReportSymptomRow[];
  symptomFrequency: string; // "Bloating 4 times | Gas 2 times"
  associations: IReportAssociationRow[];
  safeFoods: IReportSafeFoodRow[];

  progress: {
    rows: IReportProgressRow[];
    text: string;
    available: boolean;
  };

  disclaimer: string;
}
