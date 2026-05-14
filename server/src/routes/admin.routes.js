import { Router } from "express";
import { agentRuns, creditsSchema, generatedWebsites, invoices, plans, roleSchema, subscriptions, updateCredits, updateRole, usage, users } from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("admin"));
adminRouter.get("/users", asyncHandler(users));
adminRouter.get("/usage", asyncHandler(usage));
adminRouter.get("/subscriptions", asyncHandler(subscriptions));
adminRouter.get("/agent-runs", asyncHandler(agentRuns));
adminRouter.get("/generated-websites", asyncHandler(generatedWebsites));
adminRouter.get("/plans", asyncHandler(plans));
adminRouter.get("/invoices", asyncHandler(invoices));
adminRouter.put("/users/:id/role", validateBody(roleSchema), asyncHandler(updateRole));
adminRouter.put("/users/:id/credits", validateBody(creditsSchema), asyncHandler(updateCredits));
