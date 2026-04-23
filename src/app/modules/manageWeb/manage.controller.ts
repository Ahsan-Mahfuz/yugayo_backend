import { Request, Response } from "express";

import { ManageService } from "./manage.service";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";

const addPrivacyPolicy = catchAsync(async (req: Request, res: Response) => {
  const result = await ManageService.addPrivacyPolicy(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Privacy Policy added successfully",
    data: result,
  });
});

const addTermsConditions = catchAsync(async (req: Request, res: Response) => {
  const result = await ManageService.addTermsConditions(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Terms and condition added successfully",
    data: result,
  });
});

const getPrivacyPolicy = catchAsync(async (req: Request, res: Response) => {
  const result = await ManageService.getPrivacyPolicy();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Privacy Policy retrieved successfully",
    data: result,
  });
});

const getTermsConditions = catchAsync(async (req: Request, res: Response) => {
  const result = await ManageService.getTermsConditions();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Terms and Condition retrieved successfully",
    data: result,
  });
});

export const ManageController = {
  addPrivacyPolicy,
  addTermsConditions,

  getPrivacyPolicy,
  getTermsConditions,
};
