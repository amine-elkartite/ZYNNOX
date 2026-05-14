import { Router } from "express";
import { create, generated, websiteSchema } from "../controllers/websiteController.js";
import { websiteCost } from "../config/creditCosts.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireCredits } from "../middleware/credit.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const websiteRouter = Router();

websiteRouter.use(authenticate);
websiteRouter.post("/create", validateBody(websiteSchema), requireCredits((request) => websiteCost(request.body.type)), asyncHandler(create));
websiteRouter.get("/generated", asyncHandler(generated));
