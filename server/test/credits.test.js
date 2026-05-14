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

describe("credits", () => {
  it("adds credits, removes part of them, and keeps the remaining balance", async () => {
    const app = await testApp("credits");
    const register = await request(app)
      .post("/api/auth/register")
      .send({ name: "Credit Admin", email: `credits-${Date.now()}@example.com`, password: "secure-password" });
    expect(register.status).toBe(201);

    const token = register.body.token;
    const userId = register.body.user.id;
    const initialCredits = register.body.user.credits;

    const add = await request(app)
      .post("/api/credits/admin/add")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId, amount: 100, reason: "Test add" });
    expect(add.status).toBe(200);

    const remove = await request(app)
      .post("/api/credits/admin/remove")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId, amount: 40, reason: "Test remove" });
    expect(remove.status).toBe(200);

    const balance = await request(app)
      .get("/api/credits/balance")
      .set("Authorization", `Bearer ${token}`);
    expect(balance.status).toBe(200);
    expect(balance.body.balance).toBe(initialCredits + 100 - 40);
  });
});
