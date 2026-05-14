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
  process.env.AI_API_KEY = "";
  process.env.OPENAI_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.DEEPSEEK_API_KEY = "";
  process.env.GOOGLE_AI_API_KEY = "";
  process.env.GROQ_API_KEY = "";
  process.env.OPENROUTER_API_KEY = "";
  process.env.MISTRAL_API_KEY = "";
  process.env.TOGETHER_API_KEY = "";
  process.env.PERPLEXITY_API_KEY = "";
  process.env.RATE_LIMIT_MAX = "10000";
  process.env.MEMORY_FILE = fileURLToPath(new URL(`../data/${name}-${Date.now()}-${Math.random()}.json`, import.meta.url));
  vi.resetModules();
  const { createApp } = await import("../src/app.js");
  const { initializeMemoryService } = await import("../src/services/memoryService.js");
  await initializeMemoryService();
  return createApp();
}

describe("conversation intelligence", () => {
  it("answers simple greetings directly instead of using the document-analysis pipeline", async () => {
    const app = await testApp("conversation");
    const register = await request(app)
      .post("/api/auth/register")
      .send({ name: "Amine Example", email: `conversation-${Date.now()}@example.com`, password: "secure-password" });
    expect(register.status).toBe(201);

    const chat = await request(app)
      .post("/api/agent/chat")
      .set("Authorization", `Bearer ${register.body.token}`)
      .send({ message: "hi" });

    expect(chat.status).toBe(200);
    expect(chat.body.answer).toBe("Hi Amine! How can I help you today?");
    expect(chat.body.intelligence.category).toBe("conversation");
    expect(chat.body.intelligence.providerResponses).toEqual([]);
    expect(chat.body.intelligence.search.resultCount).toBe(0);

    const darija = await request(app)
      .post("/api/agent/chat")
      .set("Authorization", `Bearer ${register.body.token}`)
      .send({ message: "labas" });

    expect(darija.status).toBe(200);
    expect(darija.body.answer).toBe("Lhamdolilah, labas 😊\nNta kif dayr Amine?");
    expect(darija.body.intelligence.category).toBe("conversation");
    expect(darija.body.intelligence.providerResponses).toEqual([]);
    expect(darija.body.intelligence.search.resultCount).toBe(0);

    const salam = await request(app)
      .post("/api/agent/chat")
      .set("Authorization", `Bearer ${register.body.token}`)
      .send({ message: "slm" });

    expect(salam.status).toBe(200);
    expect(salam.body.answer).toBe("Wa alaykom salam Amine! Labas?");
    expect(salam.body.intelligence.category).toBe("conversation");
    expect(salam.body.intelligence.providerResponses).toEqual([]);
    expect(salam.body.intelligence.search.resultCount).toBe(0);
    expect(salam.body.creditsUsed).toBe(0);
    expect(salam.body.remainingCredits).toBe(25);

    const noProvider = await request(app)
      .post("/api/agent/chat")
      .set("Authorization", `Bearer ${register.body.token}`)
      .send({ message: "Explain how transformers work" });

    expect(noProvider.status).toBe(200);
    expect(noProvider.body.answer).toContain("Live AI is not configured yet.");
    expect(noProvider.body.creditsUsed).toBe(0);
    expect(noProvider.body.remainingCredits).toBe(25);
  });
});
