import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

async function testApp(name) {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "";
  process.env.JWT_SECRET = "test_jwt_secret";
  process.env.BILLING_MODE = "demo";
  process.env.AI_MODE = "demo";
  process.env.SEARCH_MODE = "demo";
  process.env.RATE_LIMIT_MAX = "10000";
  process.env.MEMORY_FILE = fileURLToPath(new URL(`../data/${name}-${Date.now()}-${Math.random()}.json`, import.meta.url));
  vi.resetModules();
  const { createApp } = await import("../src/app.js");
  const { initializeMemoryService } = await import("../src/services/memoryService.js");
  await initializeMemoryService();
  return createApp();
}

describe("health", () => {
  it("returns ok", async () => {
    const app = await testApp("health");
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
