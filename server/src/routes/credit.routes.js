import { Router } from "express";
import { adminAddCredits, adminCreditSchema, adminRemoveCredits, balance, buyCreditsNotice, transactions } from "../controllers/creditController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const creditRouter = Router();

creditRouter.use(authenticate);
creditRouter.get("/balance", asyncHandler(balance));
creditRouter.get("/transactions", asyncHandler(transactions));
creditRouter.post("/buy", asyncHandler(buyCreditsNotice));
creditRouter.post("/admin/add", requireRole("admin"), validateBody(adminCreditSchema), asyncHandler(adminAddCredits));
creditRouter.post("/admin/remove", requireRole("admin"), validateBody(adminCreditSchema), asyncHandler(adminRemoveCredits));
