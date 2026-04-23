import { z } from "zod";

const mealTypeEnum = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

const unitEnum = z.enum([
  "g",
  "gram",
  "kg",
  "ml",
  "l",
  "oz",
  "lb",
  "piece",
  "pieces",
  "cup",
  "tbsp",
  "tsp",
  "serving",
]);

// ─── Manual Entry ─────────────────────────────────────────────────────────────

export const manualFoodLogSchema = z.object({
  foods: z
    .array(
      z.object({
        foodName: z.string().min(1, "Food name is required").trim(),
        quantity: z.number().positive("Quantity must be positive"),
        unit: unitEnum,
      }),
    )
    .min(1, "At least one food item is required"),
  mealType: mealTypeEnum,
});

// ─── Voice Entry ──────────────────────────────────────────────────────────────

export const voiceFoodLogSchema = z.object({
  text: z.string().min(3, "Voice text is too short").max(500).trim(),
});

// ─── Barcode Entry ────────────────────────────────────────────────────────────

export const barcodeFoodLogSchema = z.object({
  barcode: z
    .string()
    .min(4, "Barcode is too short")
    .max(30, "Barcode too long"),
  mealType: mealTypeEnum,
  quantity: z.number().positive().optional(),
  unit: unitEnum.optional(),
});
