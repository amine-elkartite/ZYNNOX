import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { addCredits } from "../services/creditService.js";
import { createUser, findUserByEmail, findUserPrivateById, updateUserProfile } from "../services/memoryService.js";
import { AppError } from "../utils/AppError.js";

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
});

export const profileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  company: z.string().max(160).optional(),
  timezone: z.string().max(80).optional()
});

function token(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function safe(user) {
  const publicUser = { ...user };
  delete publicUser.passwordHash;
  return publicUser;
}

export async function register(request, response) {
  const existing = await findUserByEmail(request.body.email);
  if (existing) throw new AppError("Email is already registered.", 409, "AUTH_EMAIL_EXISTS");
  const passwordHash = await bcrypt.hash(request.body.password, 12);
  const user = await createUser({ name: request.body.name, email: request.body.email, passwordHash });
  const starter = await addCredits({
    userId: user.id,
    amount: env.freeStarterCredits,
    reason: "Free starter credits",
    referenceType: "registration",
    referenceId: user.id
  });
  response.status(201).json({ ok: true, token: token(user), user: { ...safe(user), credits: starter.user.credits } });
}

export async function login(request, response) {
  const user = await findUserByEmail(request.body.email);
  if (!user) throw new AppError("Invalid email or password.", 401, "AUTH_INVALID_CREDENTIALS");
  const valid = await bcrypt.compare(request.body.password, user.passwordHash);
  if (!valid) throw new AppError("Invalid email or password.", 401, "AUTH_INVALID_CREDENTIALS");
  response.json({ ok: true, token: token(user), user: safe(user) });
}

export async function logout(_request, response) {
  response.json({ ok: true, message: "Logged out. Remove the JWT on the client." });
}

export async function me(request, response) {
  response.json({ ok: true, user: request.user });
}

export async function updateProfile(request, response) {
  const result = await updateUserProfile(request.user.id, request.body);
  response.json({ ok: true, ...result });
}

export async function verifyProfile(request, response) {
  const user = await findUserPrivateById(request.user.id);
  response.json({
    ok: true,
    verified: Boolean(user),
    profile: request.user,
    emailVerificationReady: true,
    passwordResetReady: true,
    refreshTokenReady: true
  });
}
