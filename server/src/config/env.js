import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
dotenv.config();

const trimSlash = (value) => String(value || "").replace(/\/+$/, "");
const placeholderPattern = /^(your_|change_me|changeme|example_|test_|dev_jwt_secret_change_me$)/i;
const secret = (value) => {
  const resolved = String(value || "").trim();
  return resolved && !placeholderPattern.test(resolved) ? resolved : "";
};
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
  aiApiKey: secret(process.env.AI_API_KEY),
  aiBaseUrl: trimSlash(process.env.AI_BASE_URL || "https://api.openai.com/v1"),
  aiModel: process.env.AI_MODEL || "gpt-4o-mini",
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000),
  intelligenceMode: process.env.INTELLIGENCE_MODE || "demo",
  intelligenceProviderTimeoutMs: Number(process.env.INTELLIGENCE_PROVIDER_TIMEOUT_MS || 30000),
  intelligenceCacheTtlMs: Number(process.env.INTELLIGENCE_CACHE_TTL_MS || 60 * 60 * 1000),
  intelligenceHighSimilarity: Number(process.env.INTELLIGENCE_HIGH_SIMILARITY || 0.92),
  intelligenceContextSimilarity: Number(process.env.INTELLIGENCE_CONTEXT_SIMILARITY || 0.75),
  intelligenceMonthlyBudgetUsd: Number(process.env.INTELLIGENCE_MONTHLY_BUDGET_USD || 0),
  providers: {
    anthropic: { apiKey: secret(process.env.ANTHROPIC_API_KEY), model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest" },
    openai: { apiKey: secret(process.env.OPENAI_API_KEY) || secret(process.env.AI_API_KEY), model: process.env.OPENAI_MODEL || "gpt-4o" },
    deepseek: { apiKey: secret(process.env.DEEPSEEK_API_KEY), model: process.env.DEEPSEEK_MODEL || "deepseek-chat" },
    google: { apiKey: secret(process.env.GOOGLE_AI_API_KEY), model: process.env.GOOGLE_AI_MODEL || "gemini-1.5-pro" },
    groq: { apiKey: secret(process.env.GROQ_API_KEY), model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" },
    openrouter: { apiKey: secret(process.env.OPENROUTER_API_KEY), model: process.env.OPENROUTER_MODEL || "openai/gpt-4o" },
    mistral: { apiKey: secret(process.env.MISTRAL_API_KEY), model: process.env.MISTRAL_MODEL || "mistral-large-latest" },
    xai: { apiKey: secret(process.env.XAI_API_KEY), model: process.env.XAI_MODEL || "grok-2" },
    together: { apiKey: secret(process.env.TOGETHER_API_KEY), model: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
    perplexity: { apiKey: secret(process.env.PERPLEXITY_API_KEY), model: process.env.PERPLEXITY_MODEL || "sonar-pro" }
  },
  searchMode: process.env.SEARCH_MODE || "demo",
  searchProvider: process.env.SEARCH_PROVIDER || "serper",
  searchApiKey: secret(process.env.SEARCH_API_KEY),
  searchKeys: {
    brave: secret(process.env.BRAVE_SEARCH_API_KEY),
    google: secret(process.env.GOOGLE_SEARCH_API_KEY),
    googleCx: process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_ID || "",
    bing: secret(process.env.BING_API_KEY),
    serper: secret(process.env.SERPER_API_KEY) || secret(process.env.SEARCH_API_KEY),
    news: secret(process.env.NEWS_API_KEY),
    github: secret(process.env.GITHUB_TOKEN),
    redditClientId: secret(process.env.REDDIT_CLIENT_ID),
    redditClientSecret: secret(process.env.REDDIT_CLIENT_SECRET)
  },
  supabaseUrl: secret(process.env.SUPABASE_URL),
  supabaseServiceKey: secret(process.env.SUPABASE_SERVICE_KEY),
  maxSearchResults: Number(process.env.MAX_SEARCH_RESULTS || 6),
  billingMode: process.env.BILLING_MODE || "demo",
  paymentProvider: process.env.PAYMENT_PROVIDER || "stripe",
  stripeSecretKey: secret(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: secret(process.env.STRIPE_WEBHOOK_SECRET),
  stripePrices: {
    starter: process.env.STRIPE_PRICE_STARTER || "",
    pro: process.env.STRIPE_PRICE_PRO || "",
    business: process.env.STRIPE_PRICE_BUSINESS || ""
  },
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "1mb",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120)
};

export function configuredAiProviderNames() {
  return Object.entries(env.providers)
    .filter(([, config]) => Boolean(config.apiKey))
    .map(([provider]) => provider);
}

export function configuredSearchProviderNames() {
  const providers = [];
  if (env.searchKeys.brave) providers.push("brave");
  if (env.searchKeys.google && env.searchKeys.googleCx) providers.push("google");
  if (env.searchKeys.bing) providers.push("bing");
  if (env.searchKeys.serper) providers.push("serper");
  if (env.searchKeys.news) providers.push("newsapi");
  if (env.searchKeys.github) providers.push("github");
  providers.push("arxiv", "wikipedia", "stackoverflow");
  return providers;
}

export function assertRuntimeConfig() {
  if (env.isProduction && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production.");
  }
  if (env.isProduction && env.billingMode === "production" && !env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is required when BILLING_MODE=production.");
  }
  if (env.searchMode === "production" && !configuredSearchProviderNames().length) {
    throw new Error("At least one search provider key is required when SEARCH_MODE=production.");
  }
  if (env.aiMode === "production" && !configuredAiProviderNames().length) {
    throw new Error("At least one AI provider key is required when AI_MODE=production.");
  }
}

export function publicConfig() {
  return {
    environment: env.nodeEnv,
    aiMode: env.aiMode,
    aiProvider: env.aiProvider,
    aiModel: env.aiModel,
    intelligenceMode: env.intelligenceMode,
    intelligenceRuntime: configuredAiProviderNames().length ? "live" : "demo",
    liveAiProviders: configuredAiProviderNames(),
    liveSearchProviders: configuredSearchProviderNames(),
    searchMode: env.searchMode,
    searchProvider: env.searchProvider,
    billingMode: env.billingMode,
    paymentProvider: env.paymentProvider,
    storage: env.databaseUrl ? "database-ready" : "file"
  };
}
