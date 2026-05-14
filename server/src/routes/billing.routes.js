import { Router } from "express";
import { buyCreditPack, buyCreditsSchema, checkoutSchema, createCheckout, customerPortal, demoPlanUpgrade, plans, subscription, webhook } from "../controllers/billingController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const billingRouter = Router();

billingRouter.get("/plans", asyncHandler(plans));
billingRouter.post("/webhook", asyncHandler(webhook));
billingRouter.use(authenticate);
billingRouter.get("/subscription", asyncHandler(subscription));
billingRouter.post("/checkout", validateBody(checkoutSchema), asyncHandler(createCheckout));
billingRouter.post("/customer-portal", asyncHandler(customerPortal));
billingRouter.post("/buy-credits", validateBody(buyCreditsSchema), asyncHandler(buyCreditPack));
billingRouter.post("/demo-upgrade", validateBody(checkoutSchema), asyncHandler(demoPlanUpgrade));
