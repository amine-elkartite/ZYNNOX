import { Router } from "express";
import { chat, chatSchema, dashboard, runs, tools } from "../controllers/agentController.js";
import { estimateChatCost } from "../config/creditCosts.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireCredits } from "../middleware/credit.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const agentRouter = Router();

agentRouter.use(authenticate);
agentRouter.post("/chat", validateBody(chatSchema), requireCredits((request) => estimateChatCost(request.body.message)), asyncHandler(chat));
agentRouter.get("/runs", asyncHandler(runs));
agentRouter.get("/tools", asyncHandler(tools));
agentRouter.get("/dashboard", asyncHandler(dashboard));
