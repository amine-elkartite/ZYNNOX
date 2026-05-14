import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { adminRouter } from "./routes/admin.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { aiSearchRouter } from "./routes/aiSearch.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { webhook } from "./controllers/billingController.js";
import { conversationRouter } from "./routes/conversation.routes.js";
import { creditRouter } from "./routes/credit.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { websiteRouter } from "./routes/website.routes.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { apiRateLimit } from "./middleware/rateLimit.middleware.js";
import { asyncHandler } from "./utils/asyncHandler.js";

const clientDistPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
const clientIndexPath = path.join(clientDistPath, "index.html");

function serveClientApp(request, response) {
  if (fs.existsSync(clientIndexPath)) return response.sendFile(clientIndexPath);
  const clientUrl = env.clientUrls[0];
  if (request.path === "/" && clientUrl) return response.redirect(302, clientUrl);
  return response.status(200).json({
    ok: true,
    name: "ZYNNOX API",
    message: "The React app runs from the client workspace in development.",
    clientUrl,
    health: "/api/health"
  });
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked origin: ${origin}`));
      }
    })
  );
  app.use(apiRateLimit);
  app.post("/api/billing/webhook", express.raw({ type: "application/json", limit: env.requestBodyLimit }), asyncHandler(webhook));
  app.use(express.json({ limit: env.requestBodyLimit }));
  if (fs.existsSync(clientDistPath)) app.use(express.static(clientDistPath, { index: false }));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/credits", creditRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/ai-search", aiSearchRouter);
  app.use("/api/website", websiteRouter);
  app.use("/api/conversations", conversationRouter);
  app.use("/api/admin", adminRouter);

  app.get(/^(?!\/api\/).*/, serveClientApp);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
