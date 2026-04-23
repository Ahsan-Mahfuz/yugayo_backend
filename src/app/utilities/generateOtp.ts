
import crypto from "crypto";

/**
 * Generates a cryptographically random 4-digit OTP string.
 */
export const generateOtp = (): string => {
  const otp = crypto.randomInt(1000, 9999);
  return String(otp);
};