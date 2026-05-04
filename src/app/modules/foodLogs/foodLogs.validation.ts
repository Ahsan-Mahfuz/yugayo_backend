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
  clientTimezone: z.string().min(2).max(100).optional(),
  clientUtcOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  clientCountry: z.string().min(2).max(3).optional(),
});

// ─── Voice Entry ──────────────────────────────────────────────────────────────

export const voiceFoodLogSchema = z.object({
  text: z.string().min(3, "Voice text is too short").max(500).trim(),
  clientTimezone: z.string().min(2).max(100).optional(),
  clientUtcOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  clientCountry: z.string().min(2).max(3).optional(),
});

// ─── Barcode Entry ────────────────────────────────────────────────────────────

export const foodNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  /** Last N calendar days from now (rolling window). Only 7 or 30 accepted; other values are ignored. */
  days: z.preprocess(
    (val) => {
      if (val === undefined || val === "" || val === null) return undefined;
      const n = typeof val === "string" ? parseInt(val, 10) : Number(val);
      if (n === 7 || n === 30) return n;
      return undefined;
    },
    z.union([z.literal(7), z.literal(30)]).optional(),
  ),
});

export const barcodeFoodLogSchema = z.object({
  barcode: z
    .string()
    .min(4, "Barcode is too short")
    .max(30, "Barcode too long"),
  mealType: mealTypeEnum,
  quantity: z.number().positive().optional(),
  unit: unitEnum.optional(),
  clientTimezone: z.string().min(2).max(100).optional(),
  clientUtcOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  clientCountry: z.string().min(2).max(3).optional(),
});
