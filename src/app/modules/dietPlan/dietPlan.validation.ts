import { z } from "zod";

const mealSuggestionSchema = z.object({
  mealType:       z.string().min(1, "Meal type is required"),
  foodSuggestion: z.string().min(1, "Food suggestion is required"),
});

export const createDietPlanSchema = z.object({
  foodsToAvoid:    z.array(z.string()).default([]),
  foodsToIncrease: z.array(z.string()).default([]),
  additionalNotes: z.string().trim().default(""),
  mealSuggestions: z.array(mealSuggestionSchema).min(1, "Add at least one meal suggestion"),
});

export const updateDietPlanSchema = z.object({
  foodsToAvoid:    z.array(z.string()).optional(),
  foodsToIncrease: z.array(z.string()).optional(),
  additionalNotes: z.string().trim().optional(),
  mealSuggestions: z.array(mealSuggestionSchema).optional(),
});