import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const trimSlash = (value) => String(value || "").replace(/\/+$/, "");
const parseOrigins = (value) =>
  String(value || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || "development";
const devSecret = nodeEnv === "production" ? "" : crypto.randomBytes(32).toString("hex");
const defaultMemoryFile = fileURLToPath(new URL("../../data/zynnox-store.json", import.meta.url));

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: Number(process.env.PORT || 5000),
  clientUrls: parseOrigins(process.env.CLIENT_URL),
  databaseUrl: process.env.DATABASE_URL || "",
  memoryFile: process.env.MEMORY_FILE || defaultMemoryFile,
  jwtSecret: process.env.JWT_SECRET || devSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  freeStarterCredits: Number(process.env.FREE_STARTER_CREDITS || 25),
  aiMode: process.env.AI_MODE || "demo",
  aiProvider: process.env.AI_PROVIDER || "openai",
  aiApiKey: process.env.AI_API_KEY || "",
  aiBaseUrl: trimSlash(process.env.AI_BASE_URL || "https://api.openai.com/v1"),
  aiModel: process.env.AI_MODEL || "gpt-4o-mini",
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000),
  searchMode: process.env.SEARCH_MODE || "demo",
  searchProvider: process.env.SEARCH_PROVIDER || "serper",
  searchApiKey: process.env.SEARCH_API_KEY || "",
  maxSearchResults: Number(process.env.MAX_SEARCH_RESULTS || 6),
  billingMode: process.env.BILLING_MODE || "demo",
  paymentProvider: process.env.PAYMENT_PROVIDER || "stripe",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePrices: {
    starter: process.env.STRIPE_PRICE_STARTER || "",
    pro: process.env.STRIPE_PRICE_PRO || "",
    business: process.env.STRIPE_PRICE_BUSINESS || ""
  },
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "1mb",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120)
};

export function assertRuntimeConfig() {
  if (env.isProduction && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production.");
  }
  if (env.isProduction && env.billingMode === "production" && !env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is required when BILLING_MODE=production.");
  }
  if (env.searchMode === "production" && !env.searchApiKey) {
    throw new Error("SEARCH_API_KEY is required when SEARCH_MODE=production.");
  }
  if (env.aiMode === "production" && !env.aiApiKey) {
    throw new Error("AI_API_KEY is required when AI_MODE=production.");
  }
}

export function publicConfig() {
  return {
    environment: env.nodeEnv,
    aiMode: env.aiMode,
    aiProvider: env.aiProvider,
    aiModel: env.aiModel,
    searchMode: env.searchMode,
    searchProvider: env.searchProvider,
    billingMode: env.billingMode,
    paymentProvider: env.paymentProvider,
    storage: env.databaseUrl ? "database-ready" : "file"
  };
}
