import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

async function trainingContext(name) {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "";
  process.env.MEMORY_FILE = fileURLToPath(new URL(`../data/${name}-${Date.now()}-${Math.random()}.json`, import.meta.url));
  vi.resetModules();
  const memory = await import("../src/services/memoryService.js");
  const training = await import("../src/services/trainingQuestionService.js");
  await memory.initializeMemoryService();
  return { memory, training };
}

describe("training question import", () => {
  it("imports multilingual CSV questions into the training question bank", async () => {
    const { memory, training } = await trainingContext("training-questions");
    const csvPath = fileURLToPath(new URL(`../data/training-questions-${Date.now()}.csv`, import.meta.url));
    await fs.writeFile(
      csvPath,
      [
        "id,domain,topic,question_type,difficulty,question,question_en,question_fr,question_ar,question_de,question_pt,question_es,languages",
        "Q1,coding,authentication,advantages_limitations,medium,\"What benefits does authentication provide, and what risks should people consider?\",\"What benefits does authentication provide, and what risks should people consider?\",\"Quels sont les avantages de l'authentification ?\",,,,,\"en,fr\"",
        "Q2,business,pricing,compare,easy,\"How should SaaS teams compare pricing plans?\",\"How should SaaS teams compare pricing plans?\",,,,,,\"en\""
      ].join("\n")
    );

    const summary = await training.importTrainingQuestionsFromCsv(csvPath, { source: "test-csv" });
    const rows = await memory.listTrainingQuestions(10);

    expect(summary.parsed).toBe(2);
    expect(summary.inserted).toBe(2);
    expect(summary.total).toBe(2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      source: "test-csv",
      sourceId: "Q1",
      domain: "coding",
      topic: "authentication",
      questionType: "advantages_limitations",
      difficulty: "medium"
    });
    expect(rows[0].translations.en).toContain("authentication");
    expect(rows[0].languages).toEqual(["en", "fr"]);
  });
});
