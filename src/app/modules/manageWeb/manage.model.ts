import mongoose, { model } from "mongoose";

//! Privacy and policy
const privacySchema = new mongoose.Schema(
  {
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

//! Terms Conditions
const termsAndConditionsSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

export const PrivacyPolicy = model("PrivacyPolicy", privacySchema);
export const TermsConditions = model(
  "TermsConditions",
  termsAndConditionsSchema,
);
