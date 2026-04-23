/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { PrivacyPolicy, TermsConditions } from "./manage.model";

//! Privacy and policy
const addPrivacyPolicy = async (payload: any) => {
  const checkIsExist = await PrivacyPolicy.findOne();
  if (checkIsExist) {
    await PrivacyPolicy.findOneAndUpdate({}, payload, {
      new: true,

      runValidators: true,
    });
  } else {
    return await PrivacyPolicy.create(payload);
  }
};

const getPrivacyPolicy = async () => {
  return await PrivacyPolicy.findOne();
};

//! Terms Conditions
const addTermsConditions = async (payload: any) => {
  const checkIsExist = await TermsConditions.findOne();
  if (checkIsExist) {
    await TermsConditions.findOneAndUpdate({}, payload, {
      new: true,
      runValidators: true,
    });
  } else {
    return await TermsConditions.create(payload);
  }
};
const getTermsConditions = async () => {
  return await TermsConditions.findOne();
};

export const ManageService = {
  addPrivacyPolicy,
  addTermsConditions,

  getPrivacyPolicy,
  getTermsConditions,
};
