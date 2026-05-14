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

describe("billing", () => {
  it("syncs demo upgrade state and does not stack repeated monthly credits", async () => {
    const app = await testApp("billing");
    const register = await request(app)
      .post("/api/auth/register")
      .send({ name: "Billing User", email: `billing-${Date.now()}@example.com`, password: "secure-password" });
    expect(register.status).toBe(201);

    const token = register.body.token;
    const firstUpgrade = await request(app)
      .post("/api/billing/demo-upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: "pro" });
    expect(firstUpgrade.status).toBe(200);
    expect(firstUpgrade.body.subscription.status).toBe("active");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.body.user.planId).toBe("pro");
    expect(me.body.user.subscriptionStatus).toBe("active");

    const firstBalance = await request(app)
      .get("/api/credits/balance")
      .set("Authorization", `Bearer ${token}`);
    expect(firstBalance.body.balance).toBe(2000);

    const secondUpgrade = await request(app)
      .post("/api/billing/demo-upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: "pro" });
    expect(secondUpgrade.status).toBe(200);

    const secondBalance = await request(app)
      .get("/api/credits/balance")
      .set("Authorization", `Bearer ${token}`);
    expect(secondBalance.body.balance).toBe(2000);
  });
});
