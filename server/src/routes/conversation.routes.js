import { Router } from "express";
import { conversationById, conversations } from "../controllers/agentController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const conversationRouter = Router();

conversationRouter.use(authenticate);
conversationRouter.get("/", asyncHandler(conversations));
conversationRouter.get("/:id", asyncHandler(conversationById));
