import express from "express";
import { auth } from "../../middleware/auth";
import { AdminController } from "./admin.controller";

const router = express.Router();

router.use(auth("admin"));

router.get("/clinicians", AdminController.getAllClinicians);

router.get("/clinicians/:clinicianId", AdminController.getClinicianDetails);

export const AdminRoutes = router;
