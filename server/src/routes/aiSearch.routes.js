import { Router } from "express";
import { aiSearch, aiSearchSchema } from "../controllers/aiSearchController.js";
import { aiSearchCost } from "../config/creditCosts.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireCredits } from "../middleware/credit.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const aiSearchRouter = Router();

aiSearchRouter.post("/", authenticate, validateBody(aiSearchSchema), requireCredits((request) => aiSearchCost(request.body.depth)), asyncHandler(aiSearch));
