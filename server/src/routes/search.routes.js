import { Router } from "express";
import { search, searchSchema } from "../controllers/searchController.js";
import { CREDIT_COSTS } from "../config/creditCosts.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireCredits } from "../middleware/credit.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const searchRouter = Router();

searchRouter.post("/", authenticate, validateBody(searchSchema), requireCredits(CREDIT_COSTS.DIRECT_SEARCH), asyncHandler(search));
