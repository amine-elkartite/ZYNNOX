import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { findUserById } from "../services/memoryService.js";
import { AppError } from "../utils/AppError.js";

export async function authenticate(request, _response, next) {
  try {
    const header = request.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new AppError("Authentication is required.", 401, "AUTH_REQUIRED");
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) throw new AppError("User no longer exists.", 401, "AUTH_INVALID_USER");
    request.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new AppError("Invalid or expired token.", 401, "AUTH_INVALID_TOKEN"));
  }
}
