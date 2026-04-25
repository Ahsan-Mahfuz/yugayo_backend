import { Router } from "express";
import { ManageRoutes } from "../modules/manageWeb/manage.routes";
import { AuthRoutes } from "../modules/auth/auth.routes";
import { ScoreRoutes } from "../modules/score/score.routes";
import { FoodLogRoutes } from "../modules/foodLogs/foodLogs.routes";
import { SymptomLogRoutes } from "../modules/symptomLog/symptomLog.routes";
import { ConnectionRoutes } from "../modules/connection/connection.routes";
import { ChatRoutes } from "../modules/chat/chat.routes";
import { ClinicianRoutes } from "../modules/clinician/clinician.routes";
import { DietPlanRoutes } from "../modules/dietPlan/dietPlan.routes";
import { FoodTagsRoutes } from "../modules/foodTags/foodTags.routes";
import { TriggerAnalysisRoutes } from "../modules/triggerAnalysis/triggerAnalysis.routes";
import { AdminRoutes } from "../modules/admin/admin.routes";
import { ClinicianDashboardRoutes } from "../modules/clinicianDashboard/clinicianDashboard.routes";
import { UserProfileRoutes } from "../modules/profile/userProfile.routes";
import { GentleNoteRoutes } from "../modules/gentleNote/gentleNote.routes";

const router = Router();

const moduleRoutes = [
  {
    path: "/manage",
    route: ManageRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/user",
    route: UserProfileRoutes,
  },
  {
    path: "/score",
    route: ScoreRoutes,
  },
  {
    path: "/food-log",
    route: FoodLogRoutes,
  },
  { path: "/symptom-log", route: SymptomLogRoutes },
  { path: "/connections", route: ConnectionRoutes },
  { path: "/chat", route: ChatRoutes },

  { path: "/clinician", route: ClinicianRoutes },
  { path: "/diet-plan", route: DietPlanRoutes },
  { path: "/food-tags", route: FoodTagsRoutes },
  { path: "/triggers", route: TriggerAnalysisRoutes },
  { path: "/admin", route: AdminRoutes },
  { path: "/clinicians", route: ClinicianDashboardRoutes },
  { path: "/gentle-note", route: GentleNoteRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
