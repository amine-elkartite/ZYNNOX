import { env } from "../config/env.js";

export function notFound(request, _response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  error.code = "ROUTE_NOT_FOUND";
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode || 500;
  response.status(statusCode).json({
    ok: false,
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "Unexpected server error.",
      details: env.isProduction && statusCode >= 500 ? undefined : error.details
    }
  });
}
