import express from "express";
import { ManageController } from "./manage.controller";
import { auth } from "../../middleware/auth";

const router = express.Router();

router.post(
  "/add-terms-conditions",
  auth("admin"),
  ManageController.addTermsConditions
);

router.post(
  "/add-privacy-policy",
  auth("admin"),
  ManageController.addPrivacyPolicy
);

router.get("/get-privacy-policy", ManageController.getPrivacyPolicy);
router.get("/get-terms-conditions", ManageController.getTermsConditions);

export const ManageRoutes = router;
