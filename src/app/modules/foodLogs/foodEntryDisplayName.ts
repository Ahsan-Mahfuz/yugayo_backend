import { IFoodLogEntry } from "./foodLogs.interface";

/** Label for UI / combined meal strings; may fall back to usda id (legacy). */
export function displayNameForFoodEntry(f: IFoodLogEntry): string {
  const raw = f.raw_food?.trim();
  if (raw) return raw;
  const desc = f.food_description?.trim();
  if (desc) return desc;
  const prod = f.product_name?.trim();
  if (prod) return prod;
  if (f.usda_id > 0) return String(f.usda_id);
  return "";
}

/**
 * Food name for POST /recommend/* AI payloads — uses text fields only, never usda_id.
 */
export function foodNameForAiPayload(f: IFoodLogEntry): string {
  const raw = f.raw_food?.trim();
  if (raw) return raw;
  const desc = f.food_description?.trim();
  if (desc) return desc;
  const prod = f.product_name?.trim();
  if (prod) return prod;
  return "food";
}
