import { Router } from "express";
import { publicConfig } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.json({ ok: true, service: "zynnox-api", config: publicConfig(), time: new Date().toISOString() });
});
