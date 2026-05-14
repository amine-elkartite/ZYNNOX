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

describe("auth", () => {
  it("registers, logs in, and reads the current user", async () => {
    const app = await testApp("auth");
    const email = `auth-${Date.now()}@example.com`;
    const password = "secure-password";

    const register = await request(app)
      .post("/api/auth/register")
      .send({ name: "Auth Tester", email, password });
    expect(register.status).toBe(201);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });
});
