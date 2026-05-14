import { AppError } from "../utils/AppError.js";

export function requireRole(...roles) {
  return (request, _response, next) => {
    if (!roles.includes(request.user?.role)) {
      next(new AppError("Insufficient permissions.", 403, "AUTH_FORBIDDEN"));
      return;
    }
    next();
  };
}
