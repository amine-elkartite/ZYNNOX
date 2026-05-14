import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { adminRouter } from "./routes/admin.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { aiSearchRouter } from "./routes/aiSearch.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { conversationRouter } from "./routes/conversation.routes.js";
import { creditRouter } from "./routes/credit.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { websiteRouter } from "./routes/website.routes.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { apiRateLimit } from "./middleware/rateLimit.middleware.js";

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
  app.use(express.json({ limit: env.requestBodyLimit }));

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

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
