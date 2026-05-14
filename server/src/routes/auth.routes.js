import { Router } from "express";
import { login, loginSchema, logout, me, profileSchema, register, registerSchema, updateProfile, verifyProfile } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(register));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(login));
authRouter.post("/logout", authenticate, asyncHandler(logout));
authRouter.get("/me", authenticate, asyncHandler(me));
authRouter.get("/verify-profile", authenticate, asyncHandler(verifyProfile));
authRouter.put("/profile", authenticate, validateBody(profileSchema), asyncHandler(updateProfile));
