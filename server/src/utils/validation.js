import { AppError } from "./AppError.js";

export function validateBody(schema) {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      next(new AppError("Request validation failed.", 400, "VALIDATION_ERROR", parsed.error.flatten()));
      return;
    }
    request.body = parsed.data;
    next();
  };
}

export function cleanText(value, maxLength = 12000) {
  return String(value || "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(email) {
  return cleanText(email, 255).toLowerCase();
}
