export const getHealthStatus = (score: number): string => {
  if (score < 45) return "Flare-up";
  if (score < 65) return "At Risk";
  return "Stable";
};
